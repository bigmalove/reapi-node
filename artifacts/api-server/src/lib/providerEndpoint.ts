export type ProviderName = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

// Vercel AI Gateway configuration (zero-config in v0.app environment)
// Uses unified endpoint https://ai-gateway.vercel.sh
const VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh";

export function resolveProviderEndpoint(_provider: ProviderName): ProviderEndpoint {
  // In v0.app environment, the AI Gateway works zero-config
  // No API key needed for supported providers (OpenAI, Anthropic, Google, etc.)
  return { baseUrl: VERCEL_AI_GATEWAY_BASE_URL, apiKey: "" };
}
