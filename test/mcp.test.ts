import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

process.env.NIKKE_DATA_DIR = path.join(import.meta.dirname, "fixtures/dist");
const { default: app } = await import("../src/app.js");

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
  return { ...result, json: result.isError ? undefined : JSON.parse(result.content[0].text) };
};

test("mcp initialize + tools/list", async () => {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(init.result.serverInfo.name, "nikke-api");
  const names = (await rpc("tools/list")).result.tools.map((t: any) => t.name);
  for (const n of ["search_nikkes", "get_nikke", "get_scene", "list_events", "api_get", "get_user_nikkes"]) {
    assert.ok(names.includes(n), n);
  }
});

test("mcp tools wrap the REST routes", async () => {
  const list = await tool("search_nikkes", { element: "fire" });
  assert.equal(list.json.characters[0].name, "라피"); // lang defaults to ko
  assert.equal(list.json.characters[0].costumes, undefined); // list is trimmed
  assert.deepEqual(Object.keys((await tool("get_nikke", { nameOrId: "1", fields: "id" })).json), ["id"]);
  const detail = (await tool("get_nikke", { nameOrId: "1" })).json; // default trims heavy fields
  assert.ok(detail.details.skills);
  assert.equal(detail.details.statsPerLevel, undefined);
  assert.equal((await tool("list_events", { q: "first" })).json.count, 1);
  assert.equal((await tool("api_get", { path: "/api/meta/filters" })).json.classes.length > 0, true);
});

test("mcp errors surface as isError", async () => {
  assert.equal((await tool("get_nikke", { nameOrId: "nope-nope" })).isError, true);
  assert.equal((await tool("api_get", { path: "/api/../etc" })).isError, true);
  const { result } = await rpc("tools/call", { name: "api_get", arguments: { path: "/openapi.json" } });
  assert.equal(result.isError, true); // schema rejects non-/api/ paths
});

test("mcp GET is 405 in stateless mode", async () => {
  assert.equal((await app.request("/mcp")).status, 405);
});
