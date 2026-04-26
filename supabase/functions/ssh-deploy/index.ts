// SSH deploy: connect to a Linux server with ip/user/password, install Docker if needed,
// upload project archive, build & run via docker compose.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client } from "npm:ssh2@1.15.0";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeployBody {
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
}

function ssh(opts: { host: string; port: number; username: string; password: string }): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("keyboard-interactive", (_name, _instructions, _lang, prompts, finish) => {
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
    conn.exec(cmd, (err, stream) => {
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
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const stream = sftp.createWriteStream(remotePath);
      stream.on("close", () => resolve());
      stream.on("error", (e: Error) => reject(e));
      stream.end(content);
    });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const logs: string[] = [];
  const log = (m: string) => {
    console.log(m);
    logs.push(m);
  };

  try {
    // Auth: must be global admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as DeployBody;
    if (!body.host || !body.username || !body.password || !body.git_url) {
      return new Response(JSON.stringify({ error: "Missing required fields (host, username, password, git_url)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const port = body.port ?? 22;
    const remoteDir = body.remote_dir || "/opt/screenflow";
    const appPort = body.app_port || "8080";
    const branch = body.git_branch || "main";

    let gitUrl = body.git_url.trim();
    if (body.git_token && /^https?:\/\//.test(gitUrl)) {
      gitUrl = gitUrl.replace(/^(https?:\/\/)/, `$1${encodeURIComponent(body.git_token)}@`);
    }

    log(`→ Connecting to ${body.username}@${body.host}:${port}…`);
    const conn = await ssh({ host: body.host, port, username: body.username, password: body.password });
    log("✓ SSH connection established");

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
      const nginxConf = `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
`;
      const compose = `services:
  web:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: '${escEnv(body.vite_supabase_url || "")}'
        VITE_SUPABASE_PUBLISHABLE_KEY: '${escEnv(body.vite_supabase_key || "")}'
        VITE_SUPABASE_PROJECT_ID: '${escEnv(body.vite_supabase_project_id || "")}'
    ports:
      - "${appPort}:80"
    restart: unless-stopped
`;
      await uploadFile(conn, `${remoteDir}/repo/Dockerfile`, Buffer.from(dockerfile));
      await uploadFile(conn, `${remoteDir}/repo/nginx.conf`, Buffer.from(nginxConf));
      await uploadFile(conn, `${remoteDir}/repo/docker-compose.yml`, Buffer.from(compose));
      log("✓ Build files ready");


      log("→ Building & starting containers (docker compose up -d --build)…");
      const composeCmd = `cd ${remoteDir}/repo && (docker compose up -d --build || docker-compose up -d --build) 2>&1`;
      const up = await exec(conn, composeCmd);
      log(up.stdout.slice(-3000));
      if (up.code !== 0) {
        log("⚠ Compose stderr: " + up.stderr.slice(-1500));
        throw new Error("docker compose failed");
      }
      log("✓ Containers started");

      const ps = await exec(conn, `cd ${remoteDir}/repo && (docker compose ps || docker-compose ps)`);
      log(ps.stdout);

      conn.end();
      const url = `http://${body.host}:${appPort}`;
      log(`🚀 Deployment complete — accessible at ${url}`);

      return new Response(JSON.stringify({ success: true, url, logs }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr: any) {
      try { conn.end(); } catch (_) {}
      throw innerErr;
    }
  } catch (e: any) {
    log("✗ ERROR: " + (e?.message || String(e)));
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e), logs }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
