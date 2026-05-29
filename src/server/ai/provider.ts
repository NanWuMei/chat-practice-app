import { config } from "../config";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIResponse = {
  content: string;
};

export async function callAI(
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<AIResponse> {
  const { temperature = 0.7, maxTokens = 4096, jsonMode = false } = options;

  if (!config.apiKey) {
    throw new Error("MIMO_API_KEY 未设置，无法调用 AI");
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${config.apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API 错误 ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };

  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("AI 返回了空内容");
  }

  return { content: choice.message.content };
}

export function extractJSON(text: string): unknown {
  try { return JSON.parse(text); } catch { /* continue */ }

  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]!.trim()); } catch { /* continue */ }
  }

  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]!); } catch { /* continue */ }
  }

  throw new Error(`无法从 AI 回复中提取 JSON:\n${text.slice(0, 500)}`);
}

export async function callAIWithRetry(
  messages: AIMessage[],
  options: { temperature?: number; maxTokens?: number; maxRetries?: number } = {}
): Promise<unknown> {
  const { maxRetries = 2, ...rest } = options;
  let lastError: Error | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const res = await callAI(messages, { ...rest, jsonMode: true });
      return extractJSON(res.content);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < maxRetries) {
        console.warn(`AI 调用失败，第 ${i + 1} 次重试...`, lastError.message);
      }
    }
  }

  throw lastError ?? new Error("AI 调用失败");
}