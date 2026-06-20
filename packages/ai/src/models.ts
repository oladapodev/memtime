import type { ModelConfig, ModelRegistry } from "./types";

/**
 * Create the default model registry with Workers AI as primary,
 * and OpenAI/Claude as configurable fallbacks.
 */
export function createDefaultRegistry(env: Record<string, string | undefined>): ModelRegistry {
  return {
    primary: {
      provider: "workers-ai",
      model: "@cf/meta/llama-3.1-8b-instruct",
    },
    fallbacks: [
      ...(env.OPENAI_API_KEY
        ? [
            {
              provider: "openai" as const,
              model: "gpt-4o",
              apiKey: env.OPENAI_API_KEY,
            },
          ]
        : []),
      ...(env.ANTHROPIC_API_KEY
        ? [
            {
              provider: "anthropic" as const,
              model: "claude-sonnet-4-20250514",
              apiKey: env.ANTHROPIC_API_KEY,
            },
          ]
        : []),
    ],
  };
}

/**
 * Call an AI model with the given prompt and system message.
 * Falls through the chain: Workers AI → OpenAI → Claude
 */
export async function callAI(
  prompt: string,
  system: string,
  registry: ModelRegistry,
  aiBinding?: { run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>> },
  signal?: AbortSignal,
): Promise<{ content: string; model: string }> {
  const errors: string[] = [];

  // Try primary (Workers AI)
  try {
    if (registry.primary.provider === "workers-ai" && aiBinding) {
      const result = await callWorkersAI(registry.primary, prompt, system, aiBinding, signal);
      return { content: result, model: registry.primary.model };
    }
  } catch (error) {
    errors.push(`Workers AI: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Try fallbacks
  for (const fallback of registry.fallbacks) {
    try {
      if (fallback.provider === "openai") {
        const result = await callOpenAI(fallback, prompt, system, signal);
        return { content: result, model: fallback.model };
      }
      if (fallback.provider === "anthropic") {
        const result = await callAnthropic(fallback, prompt, system, signal);
        return { content: result, model: fallback.model };
      }
    } catch (error) {
      errors.push(`${fallback.provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

async function callWorkersAI(
  config: ModelConfig,
  prompt: string,
  system: string,
  ai: { run: (model: string, inputs: Record<string, unknown>) => Promise<Record<string, unknown>> },
  signal?: AbortSignal,
): Promise<string> {
  const response = await ai.run(config.model, {
    prompt: `${system}\n\n${prompt}`,
    max_tokens: 4096,
    temperature: 0.3,
    stream: false,
  });

  if (signal?.aborted) throw new Error("Aborted");

  if (response && typeof response === "object" && "response" in response) {
    return (response as { response: string }).response ?? "";
  }

  // Handle alternative response formats
  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    if (typeof obj.response === "string") return obj.response;
    if (Array.isArray(obj.choices) && obj.choices[0]) {
      const choice = obj.choices[0] as Record<string, unknown>;
      if (choice.text) return String(choice.text);
      if (choice.message && typeof choice.message === "object") {
        return String((choice.message as Record<string, unknown>).content ?? "");
      }
    }
  }

  return "";
}

async function callOpenAI(
  config: ModelConfig,
  prompt: string,
  system: string,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
    signal,
  });

  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  config: ModelConfig,
  prompt: string,
  system: string,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
    }),
    signal,
  });

  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as {
    content: Array<{ text: string }>;
  };
  return data.content?.[0]?.text ?? "";
}
