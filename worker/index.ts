// Cloudflare Worker front for the Vercel deployment — caches cacheable GET
// responses at the edge so hobby-plan Vercel request usage stays low.
// The origin already marks responses: data endpoints get s-maxage=86400.
// /api/user/* is live upstream data on a shared BlablaLink account, so it
// gets a short USER_TTL edge cache instead of pass-through — repeat reads
// of the same profile absorb at the edge instead of burning the shared
// account's rate limit. ?refresh on any GET bypasses the cache once.
// ANALYTICS records one point per request (path group + HIT/MISS/PASS) —
// Vercel hobby keeps no request history, this is the traffic breakdown.

const ORIGIN = "https://nikke-api-gunwoos-projects.vercel.app";
const USER_TTL = 300;

interface Env {
  ANALYTICS: {
    writeDataPoint(p: { blobs: string[]; doubles: number[]; indexes: string[] }): void;
  };
}

// group by route family — /api/user/<openid>/nikke -> /api/user
const pathGroup = (pathname: string) => pathname.split("/").slice(0, 3).join("/") || "/";

const outgoing = (
  res: Response,
  edge: "HIT" | "MISS" | "PASS",
  userPath: boolean,
) => {
  const out = new Response(res.body, res);
  out.headers.set("x-edge-cache", edge);
  // clients keep the origin's live-data contract; only the edge caches
  if (userPath) out.headers.set("Cache-Control", "no-store");
  return out;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const userPath = url.pathname.startsWith("/api/user");
    const group = pathGroup(url.pathname);
    const track = (edge: string) =>
      env.ANALYTICS?.writeDataPoint({
        blobs: [group, edge],
        doubles: [1],
        indexes: [group],
      });

    if (request.method !== "GET" && request.method !== "HEAD") {
      const res = await fetch(ORIGIN + url.pathname + url.search, request);
      track("PASS");
      const out = new Response(res.body, res);
      out.headers.set("Cache-Control", "no-store");
      return out;
    }

    const refresh = url.searchParams.has("refresh");
    url.searchParams.delete("refresh");
    url.searchParams.sort(); // param order shouldn't split the cache
    const key = new Request(ORIGIN + url.pathname + url.search);

    if (!refresh) {
      const hit = await caches.default.match(key);
      if (hit) {
        track("HIT");
        return outgoing(hit, "HIT", userPath);
      }
    }

    // a stale If-None-Match can't match the origin's version-derived ETag
    const res = await fetch(key, { headers: { "if-none-match": "" } });
    if (res.ok) {
      const stored = new Response(res.clone().body, res);
      // user responses arrive no-store — rewrite TTL for edge storage only
      if (userPath)
        stored.headers.set("Cache-Control", `public, max-age=${USER_TTL}, s-maxage=${USER_TTL}`);
      ctx.waitUntil(caches.default.put(key, stored));
    }
    track("MISS");
    return outgoing(res, "MISS", userPath);
  },
};
