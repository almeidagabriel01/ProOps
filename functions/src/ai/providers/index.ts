import type { AiProvider } from "./provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { GroqProvider } from "./groq.provider";
import { MockProvider } from "./mock.provider";

export { GeminiProvider } from "./gemini.provider";
export { GroqProvider } from "./groq.provider";
export { MockProvider } from "./mock.provider";
export type { AiProvider, AiChatSession, ProviderEvent, ToolFeedback } from "./provider.interface";

/**
 * Factory that returns the correct AI provider based on env vars.
 * Priority: AI_PROVIDER=mock > geminiApiKey > groqApiKey
 */
export function createAiProvider(opts: {
  geminiApiKey?: string;
  groqApiKey?: string;
}): AiProvider {
  const providerOverride = process.env.AI_PROVIDER;
  if (providerOverride === "mock") {
    return new MockProvider();
  }
  if (opts.geminiApiKey) {
    return new GeminiProvider(opts.geminiApiKey);
  }
  if (opts.groqApiKey) {
    return new GroqProvider(opts.groqApiKey);
  }
  throw new Error("No AI provider configured");
}

/**
 * Returns a Groq provider for use as a transparent fallback when Gemini is rate-limited.
 */
export function createGroqFallbackProvider(groqApiKey: string): AiProvider {
  return new GroqProvider(groqApiKey);
}
