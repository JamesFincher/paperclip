import { describe, expect, it } from "vitest";
import { buildCodexExecArgs } from "./codex-args.js";

describe("buildCodexExecArgs", () => {
  it.each(["medium", "high"] as const)(
    "passes GPT-5.5 %s reasoning at regular speed",
    (modelReasoningEffort) => {
      const result = buildCodexExecArgs({
        model: "gpt-5.5",
        modelReasoningEffort,
      });

      expect(result.fastModeRequested).toBe(false);
      expect(result.fastModeApplied).toBe(false);
      expect(result.fastModeIgnoredReason).toBeNull();
      expect(result.args).toEqual([
        "exec",
        "--json",
        "--model",
        "gpt-5.5",
        "-c",
        `model_reasoning_effort="${modelReasoningEffort}"`,
        "-",
      ]);
      expect(result.args).not.toContain('service_tier="fast"');
      expect(result.args).not.toContain("features.fast_mode=true");
    },
  );

  it("ignores the fast-mode toggle for listed GPT-5.5 regular-speed runs", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.5",
      modelReasoningEffort: "high",
      fastMode: true,
    });

    expect(result.fastModeRequested).toBe(true);
    expect(result.fastModeApplied).toBe(false);
    expect(result.fastModeIgnoredReason).toContain(
      "currently only supported on gpt-5.4 or manually configured model IDs",
    );
    expect(result.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.5",
      "-c",
      'model_reasoning_effort="high"',
      "-",
    ]);
  });

  it("enables Codex fast mode overrides for GPT-5.4", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.4",
      search: true,
      fastMode: true,
    });

    expect(result.fastModeRequested).toBe(true);
    expect(result.fastModeApplied).toBe(true);
    expect(result.fastModeIgnoredReason).toBeNull();
    expect(result.args).toEqual([
      "--search",
      "exec",
      "--json",
      "--model",
      "gpt-5.4",
      "-c",
      'service_tier="fast"',
      "-c",
      "features.fast_mode=true",
      "-",
    ]);
  });

  it("enables Codex fast mode overrides for manual models", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.5-experimental",
      fastMode: true,
    });

    expect(result.fastModeRequested).toBe(true);
    expect(result.fastModeApplied).toBe(true);
    expect(result.fastModeIgnoredReason).toBeNull();
    expect(result.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.5-experimental",
      "-c",
      'service_tier="fast"',
      "-c",
      "features.fast_mode=true",
      "-",
    ]);
  });

  it("ignores fast mode for unsupported models", () => {
    const result = buildCodexExecArgs({
      model: "gpt-5.3-codex",
      fastMode: true,
    });

    expect(result.fastModeRequested).toBe(true);
    expect(result.fastModeApplied).toBe(false);
    expect(result.fastModeIgnoredReason).toContain(
      "currently only supported on gpt-5.4 or manually configured model IDs",
    );
    expect(result.args).toEqual([
      "exec",
      "--json",
      "--model",
      "gpt-5.3-codex",
      "-",
    ]);
  });
});
