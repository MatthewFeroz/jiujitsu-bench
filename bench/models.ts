export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type MergeModel = {
  name: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  note?: string;
};

export const skateBenchModels: MergeModel[] = [
  {
    name: "kimi-k2-thinking",
    model: "moonshot/kimi-k2-thinking",
    reasoningEffort: "high"
  },
  {
    name: "kimi-k2.5",
    model: "moonshot/kimi-k25",
    reasoningEffort: "high"
  },
  {
    name: "glm-5",
    model: "zai/glm-5",
    reasoningEffort: "high"
  },
  {
    name: "minimax-m2.5",
    model: "minimax/minimax-m2.5",
    reasoningEffort: "high"
  },
  {
    name: "gpt-oss-120b-high",
    model: "openai/gpt-oss-120b",
    reasoningEffort: "high"
  },
  {
    name: "deepseek-v3.2-thinking-high",
    model: "deepseek/deepseek-v3.2",
    reasoningEffort: "high"
  },
  {
    name: "grok-4",
    model: "xai/grok-4-0709",
    reasoningEffort: "high"
  },
  {
    name: "grok-4.1-fast",
    model: "xai/grok-4-1-fast-reasoning",
    reasoningEffort: "high"
  },
  {
    name: "gemini-3-pro-preview",
    model: "google/gemini-3-pro-preview",
    reasoningEffort: "high"
  },
  {
    name: "gemini-3.1-pro-preview",
    model: "google/gemini-3.1-pro-preview"
  },
  {
    name: "claude-4.6-sonnet",
    model: "anthropic/claude-sonnet-4-6",
    reasoningEffort: "high"
  },
  {
    name: "claude-4.5-opus-thinking-high",
    model: "anthropic/claude-opus-4-5-20251101",
    reasoningEffort: "high"
  },
  {
    name: "claude-4.6-opus-thinking-high",
    model: "anthropic/claude-opus-4-6",
    reasoningEffort: "high"
  },
  {
    name: "gpt-5-minimal",
    model: "openai/gpt-5",
    reasoningEffort: "minimal"
  },
  {
    name: "gpt-5-default",
    model: "openai/gpt-5"
  },
  {
    name: "gpt-5-high",
    model: "openai/gpt-5",
    reasoningEffort: "high"
  },
  {
    name: "gpt-5-mini",
    model: "openai/gpt-5-mini"
  },
  {
    name: "gpt-5.1-high",
    model: "openai/gpt-5.1",
    reasoningEffort: "high"
  },
  {
    name: "gpt-5.2-default",
    model: "openai/gpt-5.2"
  },
  {
    name: "gpt-5.2-high",
    model: "openai/gpt-5.2",
    reasoningEffort: "high"
  },
  {
    name: "gpt-5.2-xhigh",
    model: "openai/gpt-5.2",
    reasoningEffort: "xhigh"
  },
  {
    name: "gpt-5.2-pro",
    model: "openai/gpt-5.2-pro",
    reasoningEffort: "high",
    note: "Included for SkateBench name parity; validate against your Merge catalog before running."
  },
  {
    name: "gemini-3-flash-high",
    model: "google/gemini-3-flash-preview",
    reasoningEffort: "high"
  },
  {
    name: "gemini-3-flash-low",
    model: "google/gemini-3-flash-preview",
    reasoningEffort: "low"
  }
];

export function findModels(selection: string | undefined) {
  if (!selection || selection === "all") return skateBenchModels;

  const requested = selection
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const selected = requested.map((name) => {
    const model = skateBenchModels.find(
      (candidate) => candidate.name === name || candidate.model === name
    );
    if (!model) {
      throw new Error(
        `Unknown model "${name}". Run "bun run bench:list-models" to see available names.`
      );
    }
    return model;
  });

  return selected;
}
