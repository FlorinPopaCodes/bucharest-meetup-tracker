import { strict as assert } from "node:assert";
import { findDeadUrls } from "./linkcheck.ts";

Deno.test("findDeadUrls: only 404 counts as dead", async () => {
  const server = Deno.serve({ port: 0, hostname: "127.0.0.1", onListen() {} }, (req) => {
    const path = new URL(req.url).pathname;
    if (path === "/gone") return new Response(null, { status: 404 });
    if (path === "/moved") return Response.redirect(new URL("/gone", req.url), 301);
    if (path === "/limited") return new Response(null, { status: 429 });
    return new Response(null, { status: 200 });
  });
  const base = `http://127.0.0.1:${server.addr.port}`;
  try {
    const dead = await findDeadUrls([
      `${base}/ok`,
      `${base}/gone`,
      `${base}/moved`,
      `${base}/limited`,
      "http://127.0.0.1:1/unreachable",
    ]);
    assert.deepEqual([...dead].sort(), [`${base}/gone`, `${base}/moved`]);
  } finally {
    await server.shutdown();
  }
});
