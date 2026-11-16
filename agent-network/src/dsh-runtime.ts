/**
 * DeepSeek Harness (DSH) native runtime — PHASE 1 SCAFFOLD (config-generation core).
 *
 * 状态：phase-1，仅配置生成核心，纯函数、无副作用、纯新增，暂未接入
 * normalize-runtime.ts / 启动器 lane / 构建（见 PR roadmap）。安全的增量起点。
 *
 * 为什么 DSH 通过 CommHub MCP 接入（而不是写一套专用驱动）：
 *   ANet 的每个 runtime（claude-agent-sdk / codex / grok / opencode）本质都是
 *   “拉起一个 LLM agent + 把 CommHub MCP server（`${COMMHUB_URL}/mcp`，Bearer 节点
 *   token）挂给它 + 一段任务循环提示词”。agent 用 `mcp__commhub__*` 工具拉任务、
 *   回结果。DSH 支持 MCP，所以 `dsh` runtime 是同一形状：用生成的配置把 CommHub
 *   注册成 HTTP MCP server，再启动 `dsh`。
 */

export const DSH_RUNTIME_ID = "dsh" as const;
export const DSH_RUNTIME_ALIASES = ["dsh", "dsh-cli", "deepseek-harness"] as const;

export interface CommhubMcpConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

export interface DshLaunchConfig {
  /** DSH 的 MCP servers 片段（对应 cli.ts 里的 mcpServers["commhub"]）。 */
  mcpServers: Record<string, CommhubMcpConfig>;
  /** 注入给节点这一轮的系统提示词。 */
  systemPrompt: string;
  /** 要 spawn 的 argv（phase-2 会按已安装 dsh CLI 的 headless 参数校准）。 */
  argv: string[];
  /** spawn dsh 进程要附加的 env。 */
  env: Record<string, string>;
}

export function buildCommhubMcpServer(hubUrl: string, token: string): CommhubMcpConfig {
  const base = hubUrl.replace(/\/+$/, "");
  return {
    type: "http",
    url: `${base}/mcp`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

/**
 * 教 DSH agent 使用 CommHub MCP 工具的系统提示词 —— 与 cli.ts 的
 * commhubToolGuidance 同一契约，保证与其它 runtime 行为一致。
 */
export function buildDshSystemPrompt(alias: string, from: string, taskId: string): string {
  return [
    `你是 ${alias}，一个运行在 DeepSeek Harness 上的 AI Agent 节点。收到来自 ${from} 的任务 (task_id=${taskId})。`,
    ``,
    `【多 agent 协作 — CommHub 工具】你已接入 CommHub 通信网络，可直接调用：`,
    `- mcp__commhub__get_all_status() — 查看在线 agent。`,
    `- mcp__commhub__send_task(alias, task, parent_task_id="${taskId}") — 派子任务。`,
    `- mcp__commhub__get_task(task_id) — 查任务 / 取子任务结果。`,
    `- mcp__commhub__send_message(alias, message) — 发纯消息。`,
    `- mcp__commhub__send_reply(task_id, text) — 回复本任务。`,
    `- mcp__commhub__list_tasks(...) — 查任务列表。`,
    `不要假设通信工具不可用——它们已暴露给你。完成后用 send_reply 回传结果。`,
  ].join("\n");
}

export interface BuildDshLaunchInput {
  hubUrl: string;
  token: string;
  alias: string;
  from: string;
  taskId: string;
  task: string;
  model?: string;
  workDir?: string;
}

/**
 * 构造完整的 DSH 启动描述。
 * 注意（phase-2）：以下 argv/env 是占位，需按实际安装的 `dsh` CLI headless
 * 参数校准（如 `dsh --json`）。mcpServers + systemPrompt 已遵循确认的 CommHub 契约。
 */
export function buildDshLaunchConfig(input: BuildDshLaunchInput): DshLaunchConfig {
  const commhub = buildCommhubMcpServer(input.hubUrl, input.token);
  const systemPrompt = buildDshSystemPrompt(input.alias, input.from, input.taskId);
  const argv = ["dsh", "--json", "-"]; // phase-2: 校准为真实 headless 调用
  const env: Record<string, string> = {
    DSH_MCP_SERVERS: JSON.stringify({ commhub }),
    DSH_SYSTEM_PROMPT: systemPrompt,
    DSH_TASK: input.task,
  };
  if (input.model) env.DSH_MODEL = input.model;
  if (input.workDir) env.DSH_WORKDIR = input.workDir;
  return { mcpServers: { commhub }, systemPrompt, argv, env };
}
