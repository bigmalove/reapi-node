export type ProviderName = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

// v0.app Vercel AI Gateway configuration
// Uses unified endpoint https://api.v0.dev with AI_GATEWAY_API_KEY
const V0_GATEWAY_BASE_URL = "https://api.v0.dev";

export function resolveProviderEndpoint(provider: ProviderName): ProviderEndpoint {
  const apiKey = process.env["AI_GATEWAY_API_KEY"];
  if (!apiKey) {
    throw new Error(
      `AI Gateway is not configured. Set AI_GATEWAY_API_KEY environment variable.`,
    );
  }
  return { baseUrl: V0_GATEWAY_BASE_URL, apiKey };
}
