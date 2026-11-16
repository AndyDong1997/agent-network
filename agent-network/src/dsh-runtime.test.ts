import { test, expect } from "bun:test";
import {
  buildCommhubMcpServer,
  buildDshSystemPrompt,
  buildDshLaunchConfig,
  DSH_RUNTIME_ID,
} from "./dsh-runtime";
import {
  normalizeRuntimeStrict,
  normalizeRuntime,
  SUPPORTED_RUNTIME_NAMES,
} from "./normalize-runtime";

test("dsh is a supported runtime and canonicalizes aliases", () => {
  expect(DSH_RUNTIME_ID).toBe("dsh");
  expect(SUPPORTED_RUNTIME_NAMES).toContain("dsh");
  expect(normalizeRuntimeStrict("dsh")).toBe("dsh");
  expect(normalizeRuntimeStrict("dsh-cli")).toBe("dsh");
  expect(normalizeRuntimeStrict("deepseek-harness")).toBe("dsh");
  // legacy normalizer (display/migration) also maps dsh
  expect(normalizeRuntime("dsh")).toBe("dsh");
});

test("commhub MCP server config mirrors the claude/codex contract", () => {
  const c = buildCommhubMcpServer("https://anet.lmdtrade.com/hub/", "tok123");
  expect(c.type).toBe("http");
  expect(c.url).toBe("https://anet.lmdtrade.com/hub/mcp");
  expect(c.headers?.Authorization).toBe("Bearer tok123");
});

test("dsh system prompt exposes the commhub tools", () => {
  const p = buildDshSystemPrompt("andy-1-main", "admin", "task-1");
  expect(p).toContain("mcp__commhub__send_reply");
  expect(p).toContain("mcp__commhub__get_task");
  expect(p).toContain("andy-1-main");
});

test("launch config carries model/workdir/env and commhub", () => {
  const lc = buildDshLaunchConfig({
    hubUrl: "https://h/hub",
    token: "t",
    alias: "a",
    from: "admin",
    taskId: "x",
    task: "do the thing",
    model: "deepseek-flash",
    workDir: "/w",
  });
  expect(lc.mcpServers.commhub.url).toBe("https://h/hub/mcp");
  expect(lc.env.DSH_MODEL).toBe("deepseek-flash");
  expect(lc.env.DSH_WORKDIR).toBe("/w");
  expect(lc.env.DSH_TASK).toBe("do the thing");
  expect(lc.systemPrompt).toContain("mcp__commhub__send_reply");
});
