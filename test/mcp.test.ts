import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

process.env.NIKKE_DATA_DIR = path.join(import.meta.dirname, "fixtures/dist");
const { default: app } = await import("../src/app.js");
const { fitJson } = await import("../src/mcp.js");

// stateless 2025-era Streamable HTTP: every call is a standalone POST and the
// JSON-RPC reply comes back as a single SSE message
const rpc = async (method: string, params: unknown = {}) => {
  const res = await app.request("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  assert.equal(res.status, 200);
  const data = (await res.text()).split("\n").find((l) => l.startsWith("data: "));
  return JSON.parse(data!.slice(6));
};
const tool = async (name: string, args: Record<string, unknown> = {}) => {
  const { result } = await rpc("tools/call", { name, arguments: args });
  let json: any;
  try {
    json = JSON.parse(result.content[0].text);
  } catch { /* schema errors are plain text */ }
  return { ...result, json };
};

test("mcp initialize + tools/list", async () => {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(init.result.serverInfo.name, "nikke-api");
  assert.match(init.result.instructions, /Korean only/);
  const tools = (await rpc("tools/list")).result.tools;
  const names = tools.map((t: any) => t.name);
  for (const n of ["search_nikkes", "get_nikke", "get_scene", "list_events", "api_get", "get_user_nikkes"]) {
    assert.ok(names.includes(n), n);
  }
  // the multi-server roster sweep is too heavy for a tool call
  assert.ok(!names.includes("get_user_roster"));
  const search = tools.find((t: any) => t.name === "search_nikkes");
  assert.deepEqual(search.inputSchema.properties.element.enum, ["Fire", "Water", "Wind", "Electronic", "Iron"]);
});

test("mcp tools wrap the REST routes", async () => {
  const list = await tool("search_nikkes", { element: "Fire" });
  assert.equal(list.json.characters[0].name, "라피"); // lang defaults to ko
  assert.equal(list.json.characters[0].costumes, undefined); // list is trimmed
  assert.equal((await tool("list_events", { q: "first" })).json.count, 1);
  assert.ok((await tool("api_get", { path: "/api/meta/filters" })).json.classes.length > 0);
});

test("get_nikke trims by default and include adds to it", async () => {
  const base = (await tool("get_nikke", { nameOrId: "1" })).json;
  assert.ok(base.details.skills);
  assert.equal(base.costumes, undefined);
  const more = (await tool("get_nikke", { nameOrId: "1", include: ["costumes"] })).json;
  assert.ok(more.costumes.length > 0);
  assert.equal(more.name, "라피"); // include adds, it doesn't replace the defaults
});

test("get_scene returns speaker/text lines unless media is asked for", async () => {
  const lean = (await tool("get_scene", { groupId: "d_main_01_01" })).json;
  assert.deepEqual(lean.lines[0], { speaker: "라피", text: "..." });
  const full = (await tool("get_scene", { groupId: "d_main_01_01", includeMedia: true })).json;
  assert.equal(full.lines[0].speakerName, "라피");
});

test("filters reject values outside the enum", async () => {
  assert.equal((await tool("search_nikkes", { element: "불" })).isError, true);
});

test("api_get stays inside its allowlist", async () => {
  for (const p of ["/api/user/roster?blablaid=x", "/api/tables/CharacterLevelTable.json", "/api/../etc", "/api/nikkes"]) {
    assert.equal((await tool("api_get", { path: p })).isError, true, p);
  }
  assert.equal((await tool("api_get", { path: "/openapi.json" })).isError, true); // schema: must start with /api/
});

test("mcp errors surface as isError", async () => {
  assert.equal((await tool("get_nikke", { nameOrId: "nope-nope" })).isError, true);
});

test("fitJson cuts the largest array and keeps valid JSON", () => {
  const body = JSON.stringify({ count: 500, offset: 40, scenes: Array.from({ length: 500 }, (_, i) => ({ i, pad: "x".repeat(200) })) });
  const out = fitJson(body, 10_000);
  assert.ok(out.text.length <= 10_000);
  const j = JSON.parse(out.text);
  assert.equal(j.truncated.field, "scenes");
  assert.equal(j.scenes.length, j.truncated.returned);
  assert.equal(j.truncated.nextOffset, 40 + j.truncated.returned);
  assert.equal(j.truncated.returned + j.truncated.omitted, 500);

  const flat = fitJson(JSON.stringify({ blob: "y".repeat(20_000) }), 10_000);
  assert.equal(flat.isError, true);
  assert.match(JSON.parse(flat.text).error, /too large/);
});

test("mcp GET is 405 in stateless mode", async () => {
  assert.equal((await app.request("/mcp")).status, 405);
});

// keep last: the burst guard is process-wide state
test("live user tools are rate limited per instance", async () => {
  let limited;
  for (let i = 0; i < 31; i++) limited = await tool("get_user_profile", { blablaid: "x" });
  assert.match(limited!.json.error, /rate limited/);
});
