// Cloudflare Worker front for the Vercel deployment — caches cacheable GET
// responses at the edge so hobby-plan Vercel request usage stays low.
// The origin already marks responses: data endpoints get s-maxage=86400,
// /api/user/* gets no-store, and /mcp is POST-only. Pass-through keeps the
// origin's no-store so live data never caches.

const ORIGIN = "https://nikke-api-gunwoos-projects.vercel.app";

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const upstream = ORIGIN + url.pathname + url.search;

    const cacheable =
      (request.method === "GET" || request.method === "HEAD") &&
      !url.pathname.startsWith("/api/user");
    if (!cacheable) {
      const res = await fetch(upstream, request);
      const out = new Response(res.body, res);
      out.headers.set("Cache-Control", "no-store");
      return out;
    }

    const key = new Request(upstream);
    const hit = await caches.default.match(key);
    if (hit) {
      const out = new Response(hit.body, hit);
      out.headers.set("x-edge-cache", "HIT");
      return out;
    }
    // a stale If-None-Match can't match the origin's version-derived ETag
    const res = await fetch(upstream, {
      headers: { "if-none-match": "" },
      cf: { cacheEverything: false },
    });
    if (res.ok) ctx.waitUntil(caches.default.put(key, res.clone()));
    const out = new Response(res.body, res);
    out.headers.set("x-edge-cache", "MISS");
    return out;
  },
};
