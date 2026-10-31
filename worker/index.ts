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
const USER_SWR = 86400;
const AREA_KV_TTL = 30 * 86400;

interface Env {
  ANALYTICS: {
    writeDataPoint(p: { blobs: string[]; doubles: number[]; indexes: string[] }): void;
  };
  RATE_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  AREA_KV?: { get(k: string): Promise<string | null>; put(k: string, v: string, o?: object): Promise<void> };
}

// intl_open_id from any blablaid form (path segment, base64 openid, share URL)
const intlOpenIdOf = (input: string): string | null => {
  let oid = input.trim();
  const m = oid.match(/openid=([^&\s]+)/);
  try {
    if (m) oid = decodeURIComponent(m[1]);
    const parts = atob(oid).split("-"); // "<game_id>-<intl_open_id>" or raw id
    const id = parts.length === 2 ? parts[1] : oid;
    return /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

const userTargetOf = (url: URL) => {
  const raw =
    url.pathname.match(/^\/api\/user\/([^/?]+)/)?.[1] ??
    url.searchParams.get("blablaid") ??
    url.searchParams.get("openid") ??
    url.searchParams.get("url");
  return raw ? intlOpenIdOf(raw) : null;
};

// only origin-bound requests consume the limit — cache hits cost us nothing,
// but bypass tricks (junk params, ?refresh) can't drain Vercel's quota
const throttled = async (env: Env, request: Request) => {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  return success
    ? null
    : new Response(JSON.stringify({ error: "rate limited — retry shortly" }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      });
};

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
    const target = userPath ? userTargetOf(url) : null;
    const group = pathGroup(url.pathname);
    const track = (edge: string) =>
      env.ANALYTICS?.writeDataPoint({
        blobs: [group, edge],
        doubles: [1],
        indexes: [group],
      });

    if (request.method !== "GET" && request.method !== "HEAD") {
      const denied = await throttled(env, request);
      if (denied) return denied;
      const res = await fetch(ORIGIN + url.pathname + url.search, request);
      track("PASS");
      const out = new Response(res.body, res);
      out.headers.set("Cache-Control", "no-store");
      return out;
    }

    const refresh = url.searchParams.has("refresh");
    url.searchParams.delete("refresh");
    // a remembered nikke_area_id lets the origin skip one upstream call
    if (target && !url.searchParams.has("area")) {
      const area = await env.AREA_KV?.get(target);
      if (area) url.searchParams.set("area", area);
    }
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
    const denied = await throttled(env, request);
    if (denied) return denied;
    const res = await fetch(key, { headers: { "if-none-match": "" } });
    if (res.ok) {
      const stored = new Response(res.clone().body, res);
      // user responses arrive no-store — rewrite TTL for edge storage only;
      // past USER_TTL the edge serves stale while it revalidates in the
      // background, so repeat lookups stay fast for up to SWR seconds
      if (userPath)
        stored.headers.set(
          "Cache-Control",
          `public, max-age=${USER_TTL}, s-maxage=${USER_TTL}, stale-while-revalidate=${USER_SWR}`,
        );
      ctx.waitUntil(caches.default.put(key, stored));
      // profile responses carry intlOpenId + areaId — remember the mapping
      if (target && env.AREA_KV) {
        ctx.waitUntil(
          (async () => {
            try {
              const j = (await res.clone().json()) as { intlOpenId?: string; areaId?: number };
              const openid = j.intlOpenId ?? target;
              if (typeof j.areaId === "number")
                await env.AREA_KV!.put(openid, String(j.areaId), { expirationTtl: AREA_KV_TTL });
            } catch { /* not json */ }
          })(),
        );
      }
    }
    track("MISS");
    return outgoing(res, "MISS", userPath);
  },
};
