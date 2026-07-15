// Tests for the /functions/v1/player-ready readiness probe.
//
// These tests exercise the handler in-process by importing the module and
// stubbing `Deno.serve` + `@supabase/supabase-js`. This avoids requiring a
// live Supabase project and keeps the checks deterministic.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ---- Test scaffolding ----------------------------------------------------

type Handler = (req: Request) => Promise<Response> | Response;

async function loadHandler(
  clientFactory: (url: string, key: string) => any,
): Promise<Handler> {
  // Stub env vars required by the module.
  Deno.env.set("SUPABASE_URL", "http://stub.local");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
  Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");

  // Capture the handler passed to Deno.serve without actually binding a port.
  let captured: Handler | null = null;
  const originalServe = Deno.serve;
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (handler: Handler) => {
    captured = handler;
    return { finished: Promise.resolve(), shutdown: () => {} } as any;
  };

  // Intercept the esm.sh import so createClient is our stub.
  const shim = `export const createClient = (url, key) => (globalThis.__testFactory)(url, key);`;
  const shimUrl = `data:application/javascript;base64,${btoa(shim)}`;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).__testFactory = clientFactory;

  // Fresh module import each call so the stubbed factory is picked up.
  const bust = crypto.randomUUID();
  await import(
    `./index.ts?bust=${bust}` /* @vite-ignore */
      .replace("./index.ts", new URL("./index.ts", import.meta.url).href)
  ).catch(() => {/* fallback below */});

  // The dynamic-import trick above may not re-evaluate under Deno's cache.
  // Use a wrapper module that redirects the esm.sh URL via import map at runtime.
  if (!captured) {
    const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
    const patched = src.replace(
      /from ["']https:\/\/esm\.sh\/@supabase\/supabase-js@[^"']+["']/,
      `from "${shimUrl}"`,
    );
    const modUrl = `data:application/typescript;base64,${btoa(patched)}`;
    await import(modUrl);
  }

  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = originalServe;

  if (!captured) throw new Error("handler was not captured");
  return captured;
}

function makeClient(overrides: {
  from?: () => any;
  rpc?: (name: string, args?: unknown) => Promise<{ error: unknown }>;
}) {
  return {
    from: overrides.from ?? (() => ({
      select: () => ({ limit: () => Promise.resolve({ error: null }) }),
    })),
    rpc: overrides.rpc ?? (() => Promise.resolve({ error: null })),
  };
}

// ---- Tests ---------------------------------------------------------------

Deno.test("player-ready: OPTIONS preflight returns CORS headers", async () => {
  const handler = await loadHandler(() => makeClient({}));
  const res = await handler(new Request("http://x/", { method: "OPTIONS" }));
  await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("player-ready: returns 200 ready when all checks succeed", async () => {
  const handler = await loadHandler(() =>
    makeClient({
      from: () => ({
        select: () => ({ limit: () => Promise.resolve({ error: null }) }),
      }),
      rpc: () => Promise.resolve({ error: null }),
    })
  );
  const res = await handler(new Request("http://x/"));
  const body = await res.json();
  assertEquals(res.status, 200);
  assertEquals(body.status, "ready");
  assertEquals(body.checks.length, 4);
  assert(body.checks.every((c: any) => c.ok === true));
  const names = body.checks.map((c: any) => c.name).sort();
  assertEquals(names, [
    "database",
    "rpc_log_player_metric",
    "rpc_player_health_snapshot",
    "rpc_resolve_player_screen",
  ]);
});

Deno.test("player-ready: returns 503 not_ready with per-check error detail on RPC failure", async () => {
  const handler = await loadHandler(() =>
    makeClient({
      rpc: (name: string) => {
        if (name === "resolve_player_screen") {
          return Promise.resolve({ error: { message: "boom: rpc down" } });
        }
        return Promise.resolve({ error: null });
      },
    })
  );
  const res = await handler(new Request("http://x/"));
  const body = await res.json();
  assertEquals(res.status, 503);
  assertEquals(body.status, "not_ready");
  const failed = body.checks.filter((c: any) => !c.ok);
  assertEquals(failed.length, 1);
  assertEquals(failed[0].name, "rpc_resolve_player_screen");
  assertStringIncludes(failed[0].error, "boom");
});

Deno.test("player-ready: returns 503 when database check fails", async () => {
  const handler = await loadHandler(() =>
    makeClient({
      from: () => ({
        select: () => ({
          limit: () =>
            Promise.resolve({ error: { message: "pg unreachable" } }),
        }),
      }),
    })
  );
  const res = await handler(new Request("http://x/"));
  const body = await res.json();
  assertEquals(res.status, 503);
  assertEquals(body.status, "not_ready");
  const db = body.checks.find((c: any) => c.name === "database");
  assertEquals(db.ok, false);
  assertStringIncludes(db.error, "pg unreachable");
});

Deno.test("player-ready: returns 503 when env vars are missing", async () => {
  Deno.env.delete("SUPABASE_URL");
  const handler = await loadHandler(() => makeClient({}));
  // Re-clear after loadHandler set it: force a missing var for this call.
  Deno.env.delete("SUPABASE_URL");
  const res = await handler(new Request("http://x/"));
  const body = await res.json();
  assertEquals(res.status, 503);
  assertEquals(body.status, "not_ready");
  assertStringIncludes(body.error, "Missing Supabase environment");
});
