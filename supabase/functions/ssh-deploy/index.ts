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
  // Base64 ZIP of the project (Dockerfile + nginx.conf + docker-compose.yml + dist or sources)
  project_zip_b64: string;
}

function ssh(opts: { host: string; port: number; username: string; password: string }): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", (err: Error) => reject(err))
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
    if (!body.host || !body.username || !body.password || !body.project_zip_b64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const port = body.port ?? 22;
    const remoteDir = body.remote_dir || "/opt/screenflow";
    const appPort = body.app_port || "8080";

    log(`→ Connecting to ${body.username}@${body.host}:${port}…`);
    const conn = await ssh({ host: body.host, port, username: body.username, password: body.password });
    log("✓ SSH connection established");

    try {
      // 1. Detect Docker
      log("→ Checking Docker installation…");
      const dockerCheck = await exec(conn, "command -v docker && docker --version || echo MISSING");
      const hasDocker = !dockerCheck.stdout.includes("MISSING") && dockerCheck.code === 0;
      log(hasDocker ? `✓ Docker present: ${dockerCheck.stdout.trim()}` : "✗ Docker missing");

      const composeCheck = await exec(conn, "docker compose version || docker-compose --version || echo MISSING");
      const hasCompose = !composeCheck.stdout.includes("MISSING");
      log(hasCompose ? `✓ Docker Compose present` : "✗ Docker Compose missing");

      // 2. Install Docker if needed and allowed
      if ((!hasDocker || !hasCompose) && body.install_docker) {
        log("→ Installing Docker (this may take 1-3 minutes)…");
        const installCmd = `echo '${body.password.replace(/'/g, "'\\''")}' | sudo -S sh -c "
          curl -fsSL https://get.docker.com | sh &&
          systemctl enable docker &&
          systemctl start docker &&
          usermod -aG docker ${body.username}
        "`;
        const r = await exec(conn, installCmd);
        log(r.stdout.slice(-1500));
        if (r.code !== 0) {
          const errMsg = r.stderr.slice(-1000);
          log("⚠ Install errors: " + errMsg);
          if (/not in the sudoers/i.test(errMsg) || /incorrect password/i.test(errMsg)) {
            throw new Error(
              `L'utilisateur '${body.username}' n'a pas les droits sudo sur le serveur. ` +
              `Connectez-vous en root et exécutez : 'usermod -aG sudo ${body.username}' ` +
              `(Debian/Ubuntu) ou 'usermod -aG wheel ${body.username}' (RHEL/CentOS), ` +
              `puis réessayez. Alternative : installez Docker manuellement et décochez 'Auto-installer Docker'.`
            );
          }
          throw new Error("Échec de l'installation de Docker. Voir les logs.");
        }
        log("✓ Docker installed");
      } else if (!hasDocker || !hasCompose) {
        throw new Error("Docker not installed on server. Enable 'Auto-install Docker' or install it manually.");
      }

      // 3. Prepare remote directory
      log(`→ Preparing remote directory ${remoteDir}…`);
      const sudoPrefix = `echo '${body.password.replace(/'/g, "'\\''")}' | sudo -S `;
      await exec(conn, `${sudoPrefix}mkdir -p ${remoteDir} && ${sudoPrefix}chown -R ${body.username}:${body.username} ${remoteDir}`);
      log("✓ Remote directory ready");

      // 4. Upload project ZIP
      log("→ Uploading project archive…");
      const zipBuf = Buffer.from(body.project_zip_b64, "base64");
      const remoteZip = `${remoteDir}/project.zip`;
      await uploadFile(conn, remoteZip, zipBuf);
      log(`✓ Uploaded ${(zipBuf.length / 1024 / 1024).toFixed(2)} MB`);

      // 5. Extract
      log("→ Extracting archive…");
      const unzipCheck = await exec(conn, "command -v unzip || echo MISSING");
      if (unzipCheck.stdout.includes("MISSING")) {
        log("→ Installing unzip…");
        await exec(conn, `${sudoPrefix}sh -c "apt-get update -y && apt-get install -y unzip || yum install -y unzip"`);
      }
      const ext = await exec(conn, `cd ${remoteDir} && unzip -o project.zip && rm project.zip`);
      if (ext.code !== 0) {
        log("⚠ Extract stderr: " + ext.stderr);
        throw new Error("Failed to extract project archive");
      }
      log("✓ Archive extracted");

      // 6. docker compose build & up
      log("→ Building & starting containers (docker compose up -d --build)…");
      const composeCmd = `cd ${remoteDir} && (docker compose up -d --build || docker-compose up -d --build) 2>&1`;
      const up = await exec(conn, composeCmd);
      log(up.stdout.slice(-3000));
      if (up.code !== 0) {
        log("⚠ Compose stderr: " + up.stderr.slice(-1500));
        throw new Error("docker compose failed");
      }
      log("✓ Containers started");

      // 7. Status
      const ps = await exec(conn, `cd ${remoteDir} && (docker compose ps || docker-compose ps)`);
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
