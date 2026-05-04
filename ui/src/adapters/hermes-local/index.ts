import type { UIAdapterModule } from "../types";
import { parseHermesStdoutLine } from "hermes-paperclip-adapter/ui";
import { buildHermesConfig } from "hermes-paperclip-adapter/ui";
import { SchemaConfigFields } from "../schema-config-fields";

function isBenignHermesNoise(line: string) {
  return line.includes("Normalized model") && line.includes("for openai-codex");
}

export const hermesLocalUIAdapter: UIAdapterModule = {
  type: "hermes_local",
  label: "Hermes Agent",
  parseStdoutLine: (line, ts) => isBenignHermesNoise(line) ? [] : parseHermesStdoutLine(line, ts),
  ConfigFields: SchemaConfigFields,
  buildAdapterConfig: buildHermesConfig,
};
