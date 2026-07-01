import type { MergeModel } from "./models";

export type MergeResponse = {
  text: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  raw: unknown;
};

function extractText(value: any): string {
  if (!value) return "";
  if (typeof value.output_text === "string") return value.output_text;
  if (typeof value.text === "string") return value.text;
  if (typeof value.content === "string") return value.content;

  const output = Array.isArray(value.output) ? value.output : [];
  const outputText = output
    .flatMap((item: any) => {
      if (typeof item?.content === "string") return [item.content];
      if (!Array.isArray(item?.content)) return [];
      return item.content
        .map((content: any) => content?.text ?? content?.content ?? "")
        .filter(Boolean);
    })
    .join("\n")
    .trim();
  if (outputText) return outputText;

  const choiceText = value.choices?.[0]?.message?.content;
  if (typeof choiceText === "string") return choiceText;

  return "";
}

function extractUsage(value: any) {
  const usage = value?.usage ?? {};
  const inputTokens =
    usage.input_tokens ??
    usage.prompt_tokens ??
    usage.inputTokens ??
    usage.promptTokens ??
    0;
  const outputTokens =
    usage.output_tokens ??
    usage.completion_tokens ??
    usage.outputTokens ??
    usage.completionTokens ??
    0;
  const cost =
    usage.cost ??
    usage.total_cost ??
    usage.totalCost ??
    value?.cost ??
    0;

  return {
    cost: Number(cost) || 0,
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0
  };
}

export async function createMergeResponse(input: {
  apiKey: string;
  baseUrl: string;
  model: MergeModel;
  system: string;
  prompt: string;
  timeoutSeconds: number;
  temperature: number;
}): Promise<MergeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutSeconds * 1000
  );

  try {
    const payload: Record<string, unknown> = {
      model: input.model.model,
      input: [
        {
          role: "system",
          content: input.system
        },
        {
          role: "user",
          content: input.prompt
        }
      ],
      temperature: input.temperature
    };

    if (input.model.reasoningEffort) {
      payload.reasoning = { effort: input.model.reasoningEffort };
    }

    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawText = await response.text();
    let json: any;
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      json = { text: rawText };
    }

    if (!response.ok) {
      const message =
        json?.error?.message ||
        json?.message ||
        rawText ||
        `Merge Gateway request failed with ${response.status}`;
      throw new Error(message);
    }

    const usage = extractUsage(json);
    return {
      text: extractText(json),
      ...usage,
      raw: json
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listMergeModels(input: {
  apiKey: string;
  baseUrl: string;
}) {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/models`, {
    headers: {
      Authorization: `Bearer ${input.apiKey}`
    }
  });
  const json = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(
      json?.error?.message ||
        json?.message ||
        `Merge Gateway model list failed with ${response.status}`
    );
  }
  return json;
}
