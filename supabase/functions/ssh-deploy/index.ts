// SSH deploy: connect to a Linux server with ip/user/password, install Docker if needed,
// upload project archive, build & run via docker compose.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const ssh2Mod: any = await import("npm:ssh2@1.15.0");
const Client: any = ssh2Mod.Client ?? ssh2Mod.default?.Client;
type Client = any;
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeployBody {
  // Action: "deploy" (default) or "reset_admin_password"
  action?: "deploy" | "reset_admin_password";
  // Optional override for the admin password to set during reset (defaults to 260390DS)
  admin_password?: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  remote_dir?: string;
  app_port?: string;
  install_docker?: boolean;
  vite_supabase_url?: string;
  vite_supabase_key?: string;
  vite_supabase_project_id?: string;
  // Git source (cloned on the server)
  git_url: string;            // e.g. https://github.com/user/repo.git
  git_branch?: string;        // default: main
  git_token?: string;         // optional PAT for private repos
  enable_https?: boolean;
  https_port?: string;
  https_domain?: string;
  // Local self-hosted Supabase (optional)
  install_supabase_local?: boolean;
  supabase_kong_http_port?: string;   // public REST/Auth gateway (default 8000)
  supabase_studio_port?: string;      // Supabase Studio UI (default 3000)
  supabase_db_port?: string;          // Postgres (default 5432)
}

function ssh(opts: { host: string; port: number; username: string; password: string }): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("keyboard-interactive", (_name: any, _instructions: any, _lang: any, prompts: any, finish: any) => {
        // Some servers (PAM) require keyboard-interactive even when password is enabled
        finish(prompts.map(() => opts.password));
      })
      .on("error", (err: Error) => {
        const msg = err.message || String(err);
        if (/All configured authentication methods failed/i.test(msg)) {
          reject(new Error(
            `Échec d'authentification SSH pour '${opts.username}@${opts.host}:${opts.port}'. ` +
            `Causes possibles : (1) mot de passe incorrect ; ` +
            `(2) le serveur refuse l'authentification par mot de passe — vérifiez '/etc/ssh/sshd_config' : ` +
            `'PasswordAuthentication yes' et (si vous utilisez root) 'PermitRootLogin yes', puis 'systemctl restart sshd' ; ` +
            `(3) le serveur n'autorise que les clés SSH. Essayez avec un autre utilisateur (ex: un user sudo non-root) ou activez le mot de passe.`
          ));
        } else {
          reject(err);
        }
      })
      .connect({
        host: opts.host,
        port: opts.port,
        username: opts.username,
        password: opts.password,
        readyTimeout: 20000,
        tryKeyboard: true,
      });
  });
}

function exec(conn: Client, cmd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err: any, stream: any) => {
      if (err) return reject(err);
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code: number) => resolve({ code: code ?? 0, stdout, stderr }))
        .on("data", (d: Buffer) => (stdout += d.toString()))
        .stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    });
  });
}

function uploadFile(conn: Client, remotePath: string, content: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err: any, sftp: any) => {
      if (err) return reject(err);
      const stream = sftp.createWriteStream(remotePath);
      stream.on("close", () => resolve());
      stream.on("error", (e: Error) => reject(e));
      stream.end(content);
    });
  });
}

const DEFAULT_ADMIN_EMAIL = "screenflow@screenflow.local";
const DEFAULT_ADMIN_PASSWORD = "260390DS";

const shQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

async function verifyAuthLoginFromServer(
  conn: Client,
  authBaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
  log: (m: string) => Promise<void> | void,
  fallbackCommand?: string,
) {
  const payloadB64 = btoa(JSON.stringify({ email, password }));
  const command =
    `AUTH_URL=${shQuote(`${authBaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`)} ` +
    `ANON_KEY=${shQuote(anonKey)} BODY_B64=${shQuote(payloadB64)} sh -c ` +
    shQuote(`body=$(printf "%s" "$BODY_B64" | base64 -d); curl -k -sS -m 20 -w "\\nHTTP_STATUS:%{http_code}" -X POST "$AUTH_URL" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" --data "$body"`);

  let lastOutput = "";
  for (let attempt = 1; attempt <= 45; attempt++) {
    const result = await exec(conn, attempt > 20 && fallbackCommand ? fallbackCommand : command);
    lastOutput = `${result.stdout}${result.stderr}`;
    if (result.code === 0 && /HTTP_STATUS:200/.test(lastOutput) && /"access_token"/.test(lastOutput)) {
      await log(`✓ Test login Auth réussi depuis le serveur (${authBaseUrl})`);
      return;
    }
    if (attempt === 20 && fallbackCommand) {
      await log(`⚠ Port Auth ${authBaseUrl} indisponible depuis l'hôte, test direct dans le conteneur kong…`);
    }
    await exec(conn, "sleep 2");
  }

  throw new Error(`Le compte admin existe mais le test login Auth échoue depuis le serveur (${authBaseUrl}). Réponse : ${lastOutput.slice(-700)}`);
}

async function verifyPublicAuthLogin(
  authBaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
  log: (m: string) => Promise<void> | void,
) {
  try {
    const response = await fetch(`${authBaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const text = await response.text();
    if (response.ok && text.includes("access_token")) {
      await log(`✓ Test login Auth public réussi (${authBaseUrl})`);
      return;
    }
    await log(`⚠ Test login Auth public échoué (${response.status}) : ${text.slice(0, 500)}`);
  } catch (error: any) {
    await log(`⚠ API Auth publique inaccessible depuis Lovable Cloud (${authBaseUrl}) : ${error?.message || String(error)}`);
  }
}

async function readRemoteEnv(conn: Client, envPath: string, key: string) {
  const result = await exec(conn, `grep -E '^${key}=' ${envPath} | head -1 | cut -d= -f2-`);
  return (result.stdout || "").trim();
}

function buildAuthLoginCurlCommand(authBaseUrl: string, anonKey: string, email: string, password: string) {
  const payloadB64 = btoa(JSON.stringify({ email, password }));
  return `AUTH_URL=${shQuote(`${authBaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`)} ` +
    `ANON_KEY=${shQuote(anonKey)} BODY_B64=${shQuote(payloadB64)} sh -c ` +
    shQuote(`body=$(printf "%s" "$BODY_B64" | base64 -d); curl -k -sS -m 20 -w "\\nHTTP_STATUS:%{http_code}" -X POST "$AUTH_URL" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" --data "$body"`);
}

function buildDirectKongAuthLoginCommand(supaDir: string, anonKey: string, email: string, password: string) {
  const payloadB64 = btoa(JSON.stringify({ email, password }));
  return `cd ${supaDir} && KONG_CID=$(docker compose ps -q kong) && ` +
    `KONG_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$KONG_CID" | awk '{print $1}') && ` +
    `AUTH_URL="http://$KONG_IP:8000/auth/v1/token?grant_type=password" ` +
    `ANON_KEY=${shQuote(anonKey)} BODY_B64=${shQuote(payloadB64)} sh -c ` +
    shQuote(`body=$(printf "%s" "$BODY_B64" | base64 -d); curl -k -sS -m 20 -w "\\nHTTP_STATUS:%{http_code}" -X POST "$AUTH_URL" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" --data "$body"`);
}

async function ensureLocalAuthGateway(conn: Client, supaDir: string, kongPort: string, log: (m: string) => Promise<void> | void) {
  await log(`→ Vérification de la gateway Auth locale (port ${kongPort})…`);
  const up = await exec(conn, `cd ${supaDir} && docker compose up -d kong auth rest realtime storage 2>&1 || docker compose up -d 2>&1`);
  if (up.code !== 0) {
    await log("⚠ Redémarrage gateway Auth incomplet : " + (up.stdout + up.stderr).slice(-1200));
  }
  const probe = await exec(
    conn,
    `for i in $(seq 1 45); do curl -fsS -m 5 http://127.0.0.1:${kongPort}/auth/v1/settings >/dev/null 2>&1 && echo OK && exit 0; sleep 2; done; ` +
    `echo FAIL; cd ${supaDir} && docker compose ps && docker compose logs --tail=80 kong 2>&1`
  );
  if (probe.stdout.includes("OK")) {
    await log(`✓ Gateway Auth locale accessible sur http://127.0.0.1:${kongPort}`);
    return;
  }
  throw new Error(
    `La gateway Auth locale ne répond pas sur http://127.0.0.1:${kongPort}. ` +
    `Vérifiez qu'aucun autre service n'utilise ce port ou changez le port API Supabase local. Détails : ` +
    (probe.stdout + probe.stderr).slice(-1200)
  );
}

async function upsertDefaultAdminViaAuthApi(
  conn: Client,
  supaDir: string,
  kongPort: string,
  serviceKey: string,
  password: string,
  log: (m: string) => Promise<void> | void,
) {
  await ensureLocalAuthGateway(conn, supaDir, kongPort, log);
  const existing = await exec(conn, `cd ${supaDir} && docker compose exec -T db psql -At -U postgres -d postgres -c "select id::text from auth.users where lower(email)=lower('${DEFAULT_ADMIN_EMAIL}') limit 1" 2>/dev/null || true`);
  const existingId = (existing.stdout || "").match(/[0-9a-fA-F-]{36}/)?.[0] || "";
  const body = existingId
    ? { email: DEFAULT_ADMIN_EMAIL, password, email_confirm: true, user_metadata: { display_name: "ScreenFlow Admin" }, app_metadata: { provider: "email", providers: ["email"] }, ban_duration: "none" }
    : { email: DEFAULT_ADMIN_EMAIL, password, email_confirm: true, user_metadata: { display_name: "ScreenFlow Admin" }, app_metadata: { provider: "email", providers: ["email"] } };
  const payloadB64 = btoa(JSON.stringify(body));
  const method = existingId ? "PUT" : "POST";
  const path = existingId ? `/auth/v1/admin/users/${existingId}` : "/auth/v1/admin/users";
  const call = (baseUrl: string) =>
    `API_BASE=${shQuote(baseUrl.replace(/\/$/, ""))} SERVICE_KEY=${shQuote(serviceKey)} METHOD=${method} PATH=${shQuote(path)} BODY_B64=${shQuote(payloadB64)} sh -c ` +
    shQuote(`body=$(printf "%s" "$BODY_B64" | base64 -d); curl -k -sS -m 30 -w "\\nHTTP_STATUS:%{http_code}" -X "$METHOD" "$API_BASE$PATH" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -H "Content-Type: application/json" --data "$body"`);

  let result = await exec(conn, call(`http://127.0.0.1:${kongPort}`));
  let output = `${result.stdout}${result.stderr}`;
  if (!(result.code === 0 && /HTTP_STATUS:20[01]/.test(output))) {
    await log("⚠ API Admin Auth via le port hôte indisponible, tentative directe via le conteneur kong…");
    const directBase = `cd ${supaDir} && KONG_CID=$(docker compose ps -q kong) && KONG_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$KONG_CID" | awk '{print $1}') && echo "http://$KONG_IP:8000"`;
    const direct = await exec(conn, directBase);
    const directUrl = (direct.stdout || "").trim().split(/\s+/).pop() || "";
    if (directUrl.startsWith("http://")) {
      result = await exec(conn, call(directUrl));
      output = `${result.stdout}${result.stderr}`;
    }
  }
  if (!(result.code === 0 && /HTTP_STATUS:20[01]/.test(output))) {
    throw new Error(`Impossible de créer/réparer le compte admin via l'API Auth locale. Réponse : ${output.slice(-900)}`);
  }
  await log(existingId ? "✓ Compte admin Auth réparé via API officielle" : "✓ Compte admin Auth créé via API officielle");
}

async function ensureDefaultAdminRole(conn: Client, supaDir: string, log: (m: string) => Promise<void> | void) {
  const roleSql = `
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email)=lower('${DEFAULT_ADMIN_EMAIL}') LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Compte Auth introuvable pour ${DEFAULT_ADMIN_EMAIL}';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (uid, '${DEFAULT_ADMIN_EMAIL}', 'ScreenFlow Admin')
    ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, display_name=EXCLUDED.display_name, updated_at=now();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id=uid AND role='user';
  END IF;
END $$;
`.trim();
  const roleB64 = btoa(roleSql);
  const promoted = await exec(conn, `cd ${supaDir} && echo "${roleB64}" | base64 -d | docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1`);
  if (promoted.code !== 0) throw new Error("Compte Auth créé, mais attribution du rôle admin échouée : " + (promoted.stdout + promoted.stderr).slice(-800));
  await log("✓ Rôle admin global confirmé pour screenflow@screenflow.local");
}

// Background job runner: persists progress to public.app_settings under key ssh_deploy_job:<jobId>
async function runDeploymentJob(
  jobId: string,
  body: DeployBody,
  serviceClient: ReturnType<typeof createClient>,
) {
  const logs: string[] = [];
  const settingsKey = `ssh_deploy_job:${jobId}`;

  const persist = async (patch: Record<string, unknown>) => {
    const value = JSON.stringify({
      job_id: jobId,
      updated_at: new Date().toISOString(),
      ...patch,
    });
    await serviceClient
      .from("app_settings")
      .upsert({ key: settingsKey, value }, { onConflict: "key" });
  };

  const log = async (m: string) => {
    console.log(`[${jobId}]`, m);
    logs.push(m);
    await persist({ status: "running", logs });
  };

  try {
    await persist({ status: "running", logs: [] });
    if (body.action === "reset_admin_password") {
      await runResetAdminPassword(body, log);
    } else {
      await runDeployment(body, log);
    }
    await persist({ status: "success", logs, result: (globalThis as any).__lastDeployResult || null });
  } catch (e: any) {
    logs.push("✗ ERROR: " + (e?.message || String(e)));
    await persist({ status: "error", logs, error: e?.message || String(e) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as DeployBody;
    const action = body.action || "deploy";

    if (!body.host || !body.username || !body.password) {
      return new Response(JSON.stringify({ error: "Missing required fields (host, username, password)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "deploy" && !body.git_url) {
      return new Response(JSON.stringify({ error: "Missing required field: git_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client used by background task to persist job progress (bypasses RLS via service key)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const jobId = crypto.randomUUID();

    // @ts-ignore - EdgeRuntime is provided by Supabase Functions runtime
    EdgeRuntime.waitUntil(runDeploymentJob(jobId, body, serviceClient));

    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      status_key: `ssh_deploy_job:${jobId}`,
      message: action === "reset_admin_password"
        ? "Réinitialisation du mot de passe admin lancée en arrière-plan."
        : "Déploiement lancé en arrière-plan. Suivez la progression via le polling.",
    }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== The actual deployment logic, now wrapped =====
async function runDeployment(body: DeployBody, log: (m: string) => Promise<void> | void) {
  const port = body.port ?? 22;
  const remoteDir = body.remote_dir || "/opt/screenflow";
  const appPort = body.app_port || "8080";
  const branch = body.git_branch || "main";
  const enableHttps = !!body.enable_https;
  const httpsPort = body.https_port || "8443";
  const httpsDomain = (body.https_domain || body.host).trim();
  const installSupabase = !!body.install_supabase_local;
  const supaKongPort = body.supabase_kong_http_port || "8000";
  const supaStudioPort = body.supabase_studio_port || "3001";
  const supaDbPort = body.supabase_db_port || "5432";
  let supabaseUrlOverride = "";
  let supabaseAnonOverride = "";
  let supabaseProjectIdOverride = "";

  let gitUrl = body.git_url.trim();
  if (body.git_token && /^https?:\/\//.test(gitUrl)) {
    gitUrl = gitUrl.replace(/^(https?:\/\/)/, `$1${encodeURIComponent(body.git_token)}@`);
  }

  await log(`→ Connecting to ${body.username}@${body.host}:${port}…`);
  const conn = await ssh({ host: body.host, port, username: body.username, password: body.password });
  await log("✓ SSH connection established");

    try {
      log("→ Checking Docker installation…");
      const dockerCheck = await exec(conn, "command -v docker && docker --version || echo MISSING");
      const hasDocker = !dockerCheck.stdout.includes("MISSING") && dockerCheck.code === 0;
      log(hasDocker ? `✓ Docker present: ${dockerCheck.stdout.trim()}` : "✗ Docker missing");

      const composeCheck = await exec(conn, "docker compose version || docker-compose --version || echo MISSING");
      const hasCompose = !composeCheck.stdout.includes("MISSING");
      log(hasCompose ? `✓ Docker Compose present` : "✗ Docker Compose missing");

      const sudoPrefix = `echo '${body.password.replace(/'/g, "'\\''")}' | sudo -S `;

      if ((!hasDocker || !hasCompose) && body.install_docker) {
        log("→ Installing Docker (this may take 1-3 minutes)…");
        await exec(conn, `${sudoPrefix}sh -c "(command -v apt-get && apt-get update -y && apt-get install -y curl ca-certificates git) || (command -v dnf && dnf install -y curl ca-certificates git) || (command -v yum && yum install -y curl ca-certificates git) || true"`);
        const installCmd = `${sudoPrefix}sh -c "
          (curl -fsSL https://get.docker.com -o /tmp/get-docker.sh || wget -qO /tmp/get-docker.sh https://get.docker.com) &&
          sh /tmp/get-docker.sh &&
          (systemctl enable docker || true) &&
          (systemctl start docker || service docker start || true) &&
          usermod -aG docker ${body.username} || true
        "`;
        const r = await exec(conn, installCmd);
        log(r.stdout.slice(-1500));
        if (r.code !== 0) {
          const errMsg = r.stderr.slice(-1000);
          log("⚠ Install errors: " + errMsg);
          if (/not in the sudoers/i.test(errMsg) || /incorrect password/i.test(errMsg)) {
            throw new Error(
              `L'utilisateur '${body.username}' n'a pas les droits sudo. ` +
              `En root : 'usermod -aG sudo ${body.username}' (Debian/Ubuntu) ou 'usermod -aG wheel ${body.username}' (RHEL).`
            );
          }
          throw new Error("Échec de l'installation de Docker. Voir les logs.");
        }
        log("✓ Docker installed");
      } else if (!hasDocker || !hasCompose) {
        throw new Error("Docker n'est pas installé. Activez 'Auto-installer Docker'.");
      }

      // Ensure git
      const gitCheck = await exec(conn, "command -v git || echo MISSING");
      if (gitCheck.stdout.includes("MISSING")) {
        log("→ Installing git…");
        await exec(conn, `${sudoPrefix}sh -c "(apt-get update -y && apt-get install -y git) || (dnf install -y git) || (yum install -y git)"`);
      }

      // ===== Optional: install self-hosted Supabase on the same server =====
      if (installSupabase) {
        const supaDir = `${remoteDir}/supabase`;
        log("→ Installing self-hosted Supabase (this may take 3-5 minutes)…");
        await exec(conn, `${sudoPrefix}mkdir -p ${supaDir} && ${sudoPrefix}chown -R ${body.username}:${body.username} ${supaDir}`);

        const supaClone = await exec(conn, `if [ ! -d ${supaDir}/supabase-repo ]; then git clone --depth 1 https://github.com/supabase/supabase ${supaDir}/supabase-repo 2>&1; else cd ${supaDir}/supabase-repo && git pull 2>&1; fi`);
        log(supaClone.stdout.slice(-1000));
        if (supaClone.code !== 0) throw new Error("Échec clone du dépôt Supabase: " + supaClone.stderr.slice(-300));

        await exec(conn, `cp -rn ${supaDir}/supabase-repo/docker/* ${supaDir}/ 2>/dev/null || true`);
        await exec(conn, `cp -n ${supaDir}/supabase-repo/docker/.env.example ${supaDir}/.env 2>/dev/null || true`);

        const randHex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
        const postgresPw = randHex(32);
        const jwtSecret = randHex(40);
        const dashboardPw = randHex(16);

        const jwtGen = await exec(conn, `docker run --rm -e S='${jwtSecret}' node:20-alpine node -e "const c=require('crypto');const s=process.env.S;function b64(o){return Buffer.from(JSON.stringify(o)).toString('base64url')}function sign(p){const h=b64({alg:'HS256',typ:'JWT'});const b=b64(p);const sig=c.createHmac('sha256',s).update(h+'.'+b).digest('base64url');return h+'.'+b+'.'+sig}const iat=Math.floor(Date.now()/1000),exp=iat+315360000;console.log(sign({role:'anon',iss:'supabase',iat,exp}));console.log(sign({role:'service_role',iss:'supabase',iat,exp}));"`);
        const jwtLines = jwtGen.stdout.trim().split("\n").filter((l: string) => l.startsWith("ey"));
        if (jwtLines.length < 2) {
          log("⚠ JWT gen output: " + jwtGen.stdout.slice(-400) + " | err: " + jwtGen.stderr.slice(-400));
          throw new Error("Échec génération des clés JWT Supabase");
        }
        const anonKey = jwtLines[0];
        const serviceKey = jwtLines[1];

        const appPublicUrl = enableHttps ? `https://${httpsDomain}:${httpsPort}` : `http://${body.host}:${appPort}`;
        const supaKongPublicUrl = `http://${body.host}:${supaKongPort}`;
        const supaBrowserUrl = appPublicUrl;

        const envPatch = [
          `POSTGRES_PASSWORD=${postgresPw}`,
          `JWT_SECRET=${jwtSecret}`,
          `ANON_KEY=${anonKey}`,
          `SERVICE_ROLE_KEY=${serviceKey}`,
          `SUPABASE_PUBLISHABLE_KEY=${anonKey}`,
          `SUPABASE_SECRET_KEY=${serviceKey}`,
          `DASHBOARD_USERNAME=admin`,
          `DASHBOARD_PASSWORD=${dashboardPw}`,
          `SITE_URL=${appPublicUrl}`,
          `API_EXTERNAL_URL=${supaBrowserUrl}`,
          `SUPABASE_PUBLIC_URL=${supaBrowserUrl}`,
          `KONG_HTTP_PORT=${supaKongPort}`,
          `KONG_HTTPS_PORT=${parseInt(supaKongPort) + 443}`,
          `STUDIO_PORT=${supaStudioPort}`,
          `POSTGRES_PORT=${supaDbPort}`,
          `ENABLE_EMAIL_SIGNUP=true`,
          `ENABLE_EMAIL_AUTOCONFIRM=true`,
          `ENABLE_ANONYMOUS_USERS=false`,
          `DISABLE_SIGNUP=false`,
        ].join("\n") + "\n";
        const envB64 = btoa(envPatch);
        await exec(conn, `cd ${supaDir} && for k in POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY DASHBOARD_USERNAME DASHBOARD_PASSWORD SITE_URL API_EXTERNAL_URL SUPABASE_PUBLIC_URL KONG_HTTP_PORT KONG_HTTPS_PORT STUDIO_PORT POSTGRES_PORT ENABLE_EMAIL_SIGNUP ENABLE_EMAIL_AUTOCONFIRM ENABLE_ANONYMOUS_USERS DISABLE_SIGNUP; do sed -i "/^$k=/d" .env; done && echo "${envB64}" | base64 -d >> .env && serviceKey="${serviceKey}" && echo "_OK"`);

        log(`→ Starting Supabase containers (kong:${supaKongPort}, studio:${supaStudioPort}, db:${supaDbPort})…`);
        const supaUp = await exec(conn, `cd ${supaDir} && (docker compose pull 2>&1 | tail -20) && (docker compose up -d 2>&1 | tail -40)`);
        log(supaUp.stdout.slice(-2000));
        if (supaUp.code !== 0) {
          log("⚠ Supabase compose stderr: " + supaUp.stderr.slice(-1000));
          throw new Error("Échec du démarrage de Supabase local");
        }

        supabaseUrlOverride = supaBrowserUrl;
        supabaseAnonOverride = anonKey;
        supabaseProjectIdOverride = "local";

        log(`✓ Supabase local démarré`);
        log(`  • API app: ${supaBrowserUrl} (proxy sécurisé via l'application)`);
        log(`  • API directe: ${supaKongPublicUrl}`);
        log(`  • Studio: http://${body.host}:${supaStudioPort}  (admin / ${dashboardPw})`);
        log(`  • DB:     postgres://postgres:${postgresPw}@${body.host}:${supaDbPort}/postgres`);
        log(`  ⚠ Notez le mot de passe du dashboard, il ne sera pas réaffiché.`);

        // ===== Create default global admin account (screenflow / 260390DS) =====
        log("→ Création du compte admin par défaut (screenflow@screenflow.local)…");
        // Wait for Postgres to be ready (max ~60s)
        await exec(conn, `cd ${supaDir} && for i in $(seq 1 30); do docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break || sleep 2; done`);

        // Idempotent: create or reset password. Compatible with modern auth.users schema (is_sso_user, is_anonymous).
        const adminSql = `
DO $$
DECLARE
  new_user_id uuid;
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE lower(email) = lower('${DEFAULT_ADMIN_EMAIL}') LIMIT 1;
  IF existing_id IS NULL THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
      '${DEFAULT_ADMIN_EMAIL}', crypt('${DEFAULT_ADMIN_PASSWORD}', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"ScreenFlow Admin"}'::jsonb,
      now(), now(), '', '', '', '',
      false, false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', '${DEFAULT_ADMIN_EMAIL}', 'email_verified', true),
      'email', new_user_id::text, now(), now(), now()
    );
  ELSE
    -- Reset password and clear any lock/ban to ensure login works
    UPDATE auth.users
    SET email = '${DEFAULT_ADMIN_EMAIL}',
        encrypted_password = crypt('${DEFAULT_ADMIN_PASSWORD}', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = NULL,
        deleted_at = NULL,
        aud = 'authenticated',
        role = 'authenticated',
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"display_name":"ScreenFlow Admin"}'::jsonb,
        updated_at = now()
    WHERE id = existing_id;
    new_user_id := existing_id;
  END IF;

  -- Ensure auth.identities row exists (required by GoTrue for password login)
  DELETE FROM auth.identities WHERE provider = 'email' AND user_id <> new_user_id AND provider_id = new_user_id::text;
  IF EXISTS (SELECT 1 FROM auth.identities WHERE provider = 'email' AND provider_id = new_user_id::text) THEN
    UPDATE auth.identities
    SET user_id = new_user_id,
        identity_data = jsonb_build_object('sub', new_user_id::text, 'email', '${DEFAULT_ADMIN_EMAIL}', 'email_verified', true),
        updated_at = now()
    WHERE provider = 'email' AND provider_id = new_user_id::text;
  ELSE
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', '${DEFAULT_ADMIN_EMAIL}', 'email_verified', true),
      'email', new_user_id::text, now(), now(), now()
    );
  END IF;
END $$;
`.trim();
        const adminSqlB64 = btoa(adminSql);
        const adminCreate = await exec(
          conn,
          `cd ${supaDir} && echo "${adminSqlB64}" | base64 -d | docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1`
        );
        if (adminCreate.code === 0) {
          log(`✓ Compte admin auth créé/réinitialisé : ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
        } else {
          log("⚠ Création du compte admin a échoué : " + adminCreate.stdout.slice(-800) + adminCreate.stderr.slice(-400));
        }

        // ===== Apply app migrations from cloned repo, then promote admin role =====
        // Note: we apply this AFTER the repo is cloned below. We schedule it via a marker.
        (globalThis as any).__pendingAdminPromotion = { supaDir, postgresPw: postgresPw };
      }

      log(`→ Preparing remote directory ${remoteDir}…`);
      await exec(conn, `${sudoPrefix}mkdir -p ${remoteDir} && ${sudoPrefix}chown -R ${body.username}:${body.username} ${remoteDir}`);
      log("✓ Remote directory ready");

      log(`→ Cloning ${body.git_url} (branch: ${branch})…`);
      await exec(conn, `rm -rf ${remoteDir}/repo`);
      const clone = await exec(conn, `git clone --depth 1 --branch ${branch} '${gitUrl}' ${remoteDir}/repo 2>&1`);
      log(clone.stdout.slice(-1500));
      if (clone.code !== 0) {
        throw new Error(`Échec du clone Git. Vérifiez l'URL/branche/token. ${clone.stderr.slice(-300)}`);
      }
      log("✓ Repo cloned");

      // ===== Apply app migrations to local Supabase, then promote admin =====
      const pending = (globalThis as any).__pendingAdminPromotion;
      if (pending?.supaDir) {
        log("→ Application des migrations de l'application sur Supabase local…");
        const migDir = `${remoteDir}/repo/supabase/migrations`;
        // Concat all .sql files in order and pipe to psql
        const applyMig = await exec(
          conn,
          `if [ -d "${migDir}" ]; then ` +
          `for f in $(ls ${migDir}/*.sql 2>/dev/null | sort); do ` +
          `  echo "-- $f"; cat "$f"; echo ""; ` +
          `done | (cd ${pending.supaDir} && docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0) 2>&1 | tail -100; ` +
          `else echo "no migrations dir"; fi`
        );
        log(applyMig.stdout.slice(-1500));
        log("✓ Migrations appliquées (les erreurs 'already exists' sont normales)");

        log("→ Promotion du compte screenflow en admin global…");
        const promoteSql = `
DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email)=lower('${DEFAULT_ADMIN_EMAIL}') LIMIT 1;
  IF uid IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id=uid AND role='user';
  END IF;
END $$;
`.trim();
        const promoteB64 = btoa(promoteSql);
        const promote = await exec(
          conn,
          `cd ${pending.supaDir} && echo "${promoteB64}" | base64 -d | docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1`
        );
        if (promote.code === 0) log("✓ Rôle admin attribué à screenflow@screenflow.local");
        else log("⚠ Promotion admin échouée : " + promote.stdout.slice(-400) + promote.stderr.slice(-400));

        await log("→ Test réel du login admin local…");
        const internalSupaUrl = `http://127.0.0.1:${supaKongPort}`;
        await ensureLocalAuthGateway(conn, pending.supaDir, supaKongPort, log);
        await verifyAuthLoginFromServer(
          conn,
          internalSupaUrl,
          supabaseAnonOverride,
          DEFAULT_ADMIN_EMAIL,
          DEFAULT_ADMIN_PASSWORD,
          log,
          buildDirectKongAuthLoginCommand(pending.supaDir, supabaseAnonOverride, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD),
        );
        await verifyPublicAuthLogin(supabaseUrlOverride, supabaseAnonOverride, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, log);
      }


      // Generate Dockerfile, nginx.conf, docker-compose.yml inside the repo
      log("→ Writing Dockerfile, nginx.conf, docker-compose.yml…");
      const escEnv = (s: string) => (s || "").replace(/'/g, "'\\''");
      const dockerfile = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* bun.lockb* bun.lock* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
`;
      const nginxConf = enableHttps
        ? `server {
  listen 80;
  server_name _;
  return 301 https://$host:${httpsPort}$request_uri;
}
server {
  listen 443 ssl;
  http2 on;
  server_name _;
  ssl_certificate /etc/nginx/ssl/server.crt;
  ssl_certificate_key /etc/nginx/ssl/server.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  root /usr/share/nginx/html;
  index index.html;
  location /auth/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/auth/v1/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /rest/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/rest/v1/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /storage/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/storage/v1/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /realtime/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/realtime/v1/; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; }
  location / { try_files $uri $uri/ /index.html; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
`
        : `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  location /auth/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/auth/v1/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto http; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /rest/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/rest/v1/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto http; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /storage/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/storage/v1/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto http; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  location /realtime/v1/ { proxy_pass http://host.docker.internal:${supaKongPort}/realtime/v1/; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto http; }
  location / { try_files $uri $uri/ /index.html; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
`;
      const portsBlock = enableHttps
        ? `    ports:
      - "${appPort}:80"
      - "${httpsPort}:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro`
        : `    ports:
      - "${appPort}:80"`;
      const compose = `services:
  web:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: '${escEnv(supabaseUrlOverride || body.vite_supabase_url || "")}'
        VITE_SUPABASE_PUBLISHABLE_KEY: '${escEnv(supabaseAnonOverride || body.vite_supabase_key || "")}'
        VITE_SUPABASE_PROJECT_ID: '${escEnv(supabaseProjectIdOverride || body.vite_supabase_project_id || "")}'
    extra_hosts:
      - "host.docker.internal:host-gateway"
${portsBlock}
    restart: unless-stopped
`;
      await uploadFile(conn, `${remoteDir}/repo/Dockerfile`, Buffer.from(dockerfile));
      await uploadFile(conn, `${remoteDir}/repo/nginx.conf`, Buffer.from(nginxConf));
      await uploadFile(conn, `${remoteDir}/repo/docker-compose.yml`, Buffer.from(compose));
      log("✓ Build files ready");

      if (enableHttps) {
        log("→ Generating self-signed SSL certificate…");
        const cnEsc = httpsDomain.replace(/'/g, "");
        const isIp = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) || /^[0-9a-fA-F:]+$/.test(s);
        const sanParts: string[] = [];
        if (isIp(cnEsc)) sanParts.push(`IP:${cnEsc}`); else sanParts.push(`DNS:${cnEsc}`);
        if (body.host && body.host !== cnEsc) {
          if (isIp(body.host)) sanParts.push(`IP:${body.host}`); else sanParts.push(`DNS:${body.host}`);
        }
        const san = sanParts.join(",");
        const sslCmd = `mkdir -p ${remoteDir}/repo/ssl && \
(command -v openssl || ${sudoPrefix}sh -c "(apt-get install -y openssl) || (dnf install -y openssl) || (yum install -y openssl)") && \
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout ${remoteDir}/repo/ssl/server.key \
  -out ${remoteDir}/repo/ssl/server.crt \
  -subj "/CN=${cnEsc}" \
  -addext "subjectAltName=${san}" 2>&1`;
        const ssl = await exec(conn, sslCmd);
        log(ssl.stdout.slice(-800));
        if (ssl.code !== 0) {
          throw new Error("Échec de génération du certificat SSL: " + ssl.stderr.slice(-300));
        }
        log("✓ Certificat SSL généré");
      }

      log("→ Building & starting containers (docker compose up -d --build)…");
      const composeCmd = `cd ${remoteDir}/repo && (docker compose up -d --build || docker-compose up -d --build) 2>&1`;
      const up = await exec(conn, composeCmd);
      log(up.stdout.slice(-3000));
      if (up.code !== 0) {
        log("⚠ Compose stderr: " + up.stderr.slice(-1500));
        throw new Error("docker compose failed");
      }
    await log("✓ Containers started");

    const ps = await exec(conn, `cd ${remoteDir}/repo && (docker compose ps || docker-compose ps)`);
    await log(ps.stdout);

    conn.end();
    const url = enableHttps ? `https://${body.host}:${httpsPort}` : `http://${body.host}:${appPort}`;
    await log(`🚀 Deployment complete — accessible at ${url}`);
    await log("");
    await log("════════════════════════════════════════════════════════════");
    await log("🔐  COMPTE ADMINISTRATEUR PAR DÉFAUT");
    await log("════════════════════════════════════════════════════════════");
    await log(`   URL de connexion : ${url}/login`);
    await log(`   Email            : ${DEFAULT_ADMIN_EMAIL}`);
    await log(`   Mot de passe     : ${DEFAULT_ADMIN_PASSWORD}`);
    await log(`   Rôle             : admin (global)`);
    await log("   ⚠  Pensez à changer ce mot de passe après la 1ʳᵉ connexion.");
    await log("════════════════════════════════════════════════════════════");
    await log("");

    (globalThis as any).__lastDeployResult = {
      url,
      supabase_local: installSupabase ? {
        url: supabaseUrlOverride,
        anon_key: supabaseAnonOverride,
        studio_url: `http://${body.host}:${supaStudioPort}`,
      } : null,
    };
  } catch (innerErr: any) {
    try { conn.end(); } catch (_) {}
    throw innerErr;
  }
}

// ===== Reset-only: connect via SSH and reset the default admin password =====
async function runResetAdminPassword(body: DeployBody, log: (m: string) => Promise<void> | void) {
  const port = body.port ?? 22;
  const remoteDir = body.remote_dir || "/opt/screenflow";
  const supaDir = `${remoteDir}/supabase`;
  const newPassword = (body.admin_password && body.admin_password.length >= 6)
    ? body.admin_password
    : "260390DS";

  await log(`→ Connexion SSH ${body.username}@${body.host}:${port}…`);
  const conn = await ssh({ host: body.host, port, username: body.username, password: body.password });
  await log("✓ SSH connecté");

  try {
    // Sanity check: the local Supabase stack must exist
    const check = await exec(conn, `[ -f ${supaDir}/docker-compose.yml ] && echo OK || echo MISSING`);
    if (!check.stdout.includes("OK")) {
      throw new Error(
        `Aucune installation Supabase locale trouvée dans ${supaDir}. ` +
        `Lancez d'abord un déploiement complet, ou ajustez 'remote_dir'.`
      );
    }
    await log(`✓ Stack Supabase locale détectée dans ${supaDir}`);

    // Wait for Postgres to be ready
    await log("→ Vérification que Postgres est prêt…");
    await exec(conn, `cd ${supaDir} && for i in $(seq 1 30); do docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break || sleep 2; done`);

    // Sanity check : un "pg_isready" OK ne garantit pas que psql peut lire les fichiers.
    // Si le datadir a des permissions cassées (fréquent après redémarrage Docker / changement d'UID),
    // on les répare en root dans le conteneur, puis on redémarre Postgres.
    const probe = await exec(
      conn,
      `cd ${supaDir} && docker compose exec -T db psql -U postgres -d postgres -c "select 1" 2>&1 || true`
    );
    const probeOut = (probe.stdout || "") + (probe.stderr || "");
    if (probeOut.includes("Permission denied") || probeOut.includes("pg_filenode.map")) {
      await log("⚠ Permissions du datadir Postgres cassées — réparation en cours…");
      await exec(
        conn,
        `cd ${supaDir} && docker compose exec -T -u 0 db sh -c "chown -R postgres:postgres /var/lib/postgresql/data && chmod -R u+rwX,go-rwx /var/lib/postgresql/data" 2>&1 || true`
      );
      await log("→ Redémarrage du conteneur db…");
      await exec(conn, `cd ${supaDir} && docker compose restart db 2>&1 || true`);
      await exec(conn, `cd ${supaDir} && for i in $(seq 1 60); do docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break || sleep 2; done`);
      const probe2 = await exec(
        conn,
        `cd ${supaDir} && docker compose exec -T db psql -U postgres -d postgres -c "select 1" 2>&1 || true`
      );
      const probe2Out = (probe2.stdout || "") + (probe2.stderr || "");
      if (probe2Out.includes("Permission denied") || probe2Out.includes("pg_filenode.map")) {
        throw new Error(
          "Le datadir Postgres reste inaccessible même après réparation. " +
          "Connectez-vous en SSH et exécutez manuellement : " +
          `cd ${supaDir} && docker compose down && ` +
          `sudo chown -R 70:70 volumes/db/data || sudo chown -R 999:999 volumes/db/data ; ` +
          `docker compose up -d db. Détail : ` + probe2Out.slice(-300)
        );
      }
      await log("✓ Permissions réparées et Postgres opérationnel");
    }

    // Escape password for SQL single-quoted string
    const sqlPwd = newPassword.replace(/'/g, "''");

    const resetSql = `
DO $$
DECLARE
  new_user_id uuid;
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id FROM auth.users WHERE lower(email) = lower('${DEFAULT_ADMIN_EMAIL}') LIMIT 1;
  IF existing_id IS NULL THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated',
      '${DEFAULT_ADMIN_EMAIL}', crypt('${sqlPwd}', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"ScreenFlow Admin"}'::jsonb,
      now(), now(), '', '', '', '',
      false, false
    );
  ELSE
    UPDATE auth.users
    SET email = '${DEFAULT_ADMIN_EMAIL}',
        encrypted_password = crypt('${sqlPwd}', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = NULL,
        deleted_at = NULL,
        aud = 'authenticated',
        role = 'authenticated',
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"display_name":"ScreenFlow Admin"}'::jsonb,
        updated_at = now()
    WHERE id = existing_id;
    new_user_id := existing_id;
  END IF;

  DELETE FROM auth.identities WHERE provider = 'email' AND user_id <> new_user_id AND provider_id = new_user_id::text;
  IF EXISTS (SELECT 1 FROM auth.identities WHERE provider = 'email' AND provider_id = new_user_id::text) THEN
    UPDATE auth.identities
    SET user_id = new_user_id,
        identity_data = jsonb_build_object('sub', new_user_id::text, 'email', '${DEFAULT_ADMIN_EMAIL}', 'email_verified', true),
        updated_at = now()
    WHERE provider = 'email' AND provider_id = new_user_id::text;
  ELSE
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), new_user_id,
      jsonb_build_object('sub', new_user_id::text, 'email', '${DEFAULT_ADMIN_EMAIL}', 'email_verified', true),
      'email', new_user_id::text, now(), now(), now()
    );
  END IF;

  -- Ensure admin role
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_roles') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new_user_id, 'admin') ON CONFLICT DO NOTHING;
    DELETE FROM public.user_roles WHERE user_id = new_user_id AND role = 'user';
  END IF;
END $$;
`.trim();

    await log("→ Réinitialisation du mot de passe admin en cours…");
    const sqlB64 = btoa(resetSql);

    // Récupère POSTGRES_PASSWORD depuis le .env de la stack Supabase locale
    const pwdRes = await exec(
      conn,
      `grep -E '^POSTGRES_PASSWORD=' ${supaDir}/.env | head -1 | cut -d= -f2-`
    );
    const pgPwd = (pwdRes.stdout || "").trim();
    if (!pgPwd) {
      throw new Error("Impossible de lire POSTGRES_PASSWORD dans " + supaDir + "/.env");
    }

    const kongPort = await readRemoteEnv(conn, `${supaDir}/.env`, "KONG_HTTP_PORT") || "8000";
    const publicUrl = await readRemoteEnv(conn, `${supaDir}/.env`, "SUPABASE_PUBLIC_URL") || await readRemoteEnv(conn, `${supaDir}/.env`, "API_EXTERNAL_URL") || `http://${body.host}:${kongPort}`;
    const anonKey = await readRemoteEnv(conn, `${supaDir}/.env`, "ANON_KEY") || await readRemoteEnv(conn, `${supaDir}/.env`, "SUPABASE_PUBLISHABLE_KEY");
    if (!anonKey) {
      throw new Error("Impossible de lire ANON_KEY dans " + supaDir + "/.env");
    }

    // Exécute psql via TCP (127.0.0.1) à l'intérieur du conteneur db pour
    // éviter le bug de permissions sur le socket Unix (/run/postgresql).
    const result = await exec(
      conn,
      `cd ${supaDir} && echo "${sqlB64}" | base64 -d | ` +
      `PGPASSWORD='${pgPwd.replace(/'/g, "'\\''")}' ` +
      `docker compose exec -T -e PGPASSWORD='${pgPwd.replace(/'/g, "'\\''")}' db ` +
      `psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1`
    );

    if (result.code !== 0) {
      // Fallback : tenter via le conteneur supavisor/pooler exposé sur l'hôte
      await log("⚠ psql intra-conteneur a échoué, tentative via l'hôte (port 5432)…");
      const hostRes = await exec(
        conn,
        `echo "${sqlB64}" | base64 -d | ` +
        `PGPASSWORD='${pgPwd.replace(/'/g, "'\\''")}' ` +
        `psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1`
      );
      if (hostRes.code !== 0) {
        throw new Error(
          "Échec SQL : " +
          (result.stdout + result.stderr + "\n---\n" + hostRes.stdout + hostRes.stderr).slice(-1200)
        );
      }
    }

    await log("→ Test réel du login admin local…");
    await ensureLocalAuthGateway(conn, supaDir, kongPort, log);
    await verifyAuthLoginFromServer(
      conn,
      `http://127.0.0.1:${kongPort}`,
      anonKey,
      DEFAULT_ADMIN_EMAIL,
      newPassword,
      log,
      buildDirectKongAuthLoginCommand(supaDir, anonKey, DEFAULT_ADMIN_EMAIL, newPassword),
    );
    await verifyPublicAuthLogin(publicUrl, anonKey, DEFAULT_ADMIN_EMAIL, newPassword, log);

    await log("✓ Mot de passe admin réinitialisé avec succès");
    await log("");
    await log("════════════════════════════════════════════════════════════");
    await log("🔐  COMPTE ADMINISTRATEUR — MOT DE PASSE RÉINITIALISÉ");
    await log("════════════════════════════════════════════════════════════");
    await log(`   Email            : screenflow@screenflow.local`);
    await log(`   Mot de passe     : ${newPassword}`);
    await log(`   Rôle             : admin (global)`);
    await log("   ⚠  Pensez à changer ce mot de passe après la connexion.");
    await log("════════════════════════════════════════════════════════════");

    (globalThis as any).__lastDeployResult = {
      action: "reset_admin_password",
      email: "screenflow@screenflow.local",
      password: newPassword,
    };
  } finally {
    try { conn.end(); } catch (_) {}
  }
}
