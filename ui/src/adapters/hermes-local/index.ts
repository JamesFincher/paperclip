import type { UIAdapterModule } from "../types";
import { parseHermesStdoutLine } from "hermes-paperclip-adapter/ui";
import { buildHermesConfig } from "hermes-paperclip-adapter/ui";
import { SchemaConfigFields } from "../schema-config-fields";
import type { TranscriptEntry } from "../types";

function isBenignHermesNoise(line: string) {
  return line.includes("Normalized model") && line.includes("for openai-codex");
}

const HERMES_TOOL_PREFIX = "┊";

const HERMES_TOOL_NAME_MAP: Record<string, string> = {
  "$": "shell",
  exec: "shell",
  terminal: "shell",
  find: "search",
  grep: "search",
  search: "search",
  read: "read",
  write: "write",
  patch: "patch",
  fetch: "fetch",
  crawl: "crawl",
  navigate: "browser",
  snapshot: "browser",
  click: "browser",
  type: "browser",
  scroll: "browser",
  back: "browser",
  press: "browser",
  close: "browser",
  images: "browser",
  vision: "browser",
  plan: "plan",
  recall: "recall",
  proc: "process",
  delegate: "delegate",
  todo: "todo",
  memory: "memory",
  clarify: "clarify",
  code: "execute",
  execute: "execute",
  read_file: "read",
  write_file: "write_file",
  search_files: "search",
  patch_file: "patch",
  execute_code: "execute",
};

let hermesToolCounter = 0;

function nextHermesToolId() {
  hermesToolCounter += 1;
  return `hermes-visible-tool-${hermesToolCounter}`;
}

function stripAnsi(value: string) {
  return value.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function stripLeadingSymbol(value: string) {
  return value.replace(/^\p{Extended_Pictographic}\s*/u, "").trim();
}

function shouldDropHermesChrome(line: string) {
  const trimmed = stripAnsi(line).trim();
  if (!trimmed) return true;
  if (/^[╭╰│─]+/.test(trimmed)) return true;
  if (trimmed.startsWith("Query:")) return true;
  if (trimmed === "Initializing agent...") return true;
  if (/^(AI Agent initialized|Using custom base URL|Using API key|Enabled toolset|Final tool selection|Loaded \d+ tools|Enabled toolsets|Context limit|Some tools may not work|Conversation completed)/.test(trimmed.replace(/^\p{Extended_Pictographic}\s*/u, ""))) return true;
  if (/^(Concurrent:|Tool \d+:|Tool \d+ completed|Args:|Result:)/.test(trimmed.replace(/^\p{Extended_Pictographic}\s*/u, ""))) return true;
  if (trimmed.startsWith("Resume this session with:")) return true;
  if (/^hermes\s+--resume\s+/.test(trimmed)) return true;
  if (/^(Session|Duration|Messages):\s+/.test(trimmed)) return true;
  if (/^\d+\s+tools\s+·\s+\d+\s+skills\b/.test(trimmed)) return true;
  if (/^Available (Tools|Skills)$/.test(trimmed)) return true;
  return false;
}

function parseHermesThinkingLine(line: string, ts: string): TranscriptEntry[] | null {
  const trimmed = stripAnsi(line).trim();
  const match = trimmed.match(/^\[thinking\]\s*(.*)$/);
  if (!match) return null;
  const text = match[1]?.trim() ?? "";
  return text ? [{ kind: "thinking", ts, text, delta: true }] : [];
}

function parseHermesToolLine(line: string, ts: string): TranscriptEntry[] | null {
  const trimmed = stripAnsi(line).trim().replace(/^\[done\]\s*/, "");
  if (!trimmed.startsWith(HERMES_TOOL_PREFIX)) return null;

  let detail = trimmed.slice(HERMES_TOOL_PREFIX.length).trim();
  if (!detail || /^💬/u.test(detail)) return null;
  detail = stripLeadingSymbol(detail);

  const durationMatch = detail.match(/([\d.]+s)\s*(?:\([\d.]+s\))?\s*$/);
  const duration = durationMatch?.[1] ?? "";
  const withoutDuration = durationMatch
    ? detail.slice(0, detail.lastIndexOf(durationMatch[0])).trim()
    : detail;
  const hasError = /\[(?:exit \d+|error|full)\]/i.test(withoutDuration) || /\[error\]\s*$/i.test(detail);
  const parts = withoutDuration.match(/^(\S+)\s+([\s\S]*)$/);
  if (!parts) return null;

  const verb = parts[1]?.trim() ?? "tool";
  const inputDetail = parts[2]?.trim() ?? "";
  const name = HERMES_TOOL_NAME_MAP[verb.toLowerCase()] ?? verb;
  const toolUseId = nextHermesToolId();
  const content = duration ? `${inputDetail}  ${duration}` : inputDetail;

  return [
    {
      kind: "tool_call",
      ts,
      name,
      input: { detail: inputDetail },
      toolUseId,
    },
    {
      kind: "tool_result",
      ts,
      toolUseId,
      content,
      isError: hasError,
    },
  ];
}

function parseVisibleHermesLine(line: string, ts: string): TranscriptEntry[] | null {
  if (isBenignHermesNoise(line)) return [];
  if (shouldDropHermesChrome(line)) return [];
  return parseHermesThinkingLine(line, ts) ?? parseHermesToolLine(line, ts);
}

export const hermesLocalUIAdapter: UIAdapterModule = {
  type: "hermes_local",
  label: "Hermes Agent",
  parseStdoutLine: (line, ts) => parseVisibleHermesLine(line, ts) ?? parseHermesStdoutLine(line, ts),
  ConfigFields: SchemaConfigFields,
  buildAdapterConfig: buildHermesConfig,
};
