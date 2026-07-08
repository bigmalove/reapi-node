export type ProviderName = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

// v0.app AI Gateway configuration
// Uses unified endpoint https://api.v0.dev
const V0_GATEWAY_BASE_URL = "https://api.v0.dev";

export function resolveProviderEndpoint(_provider: ProviderName): ProviderEndpoint {
  const apiKey = process.env["V0_API_KEY"] || process.env["AI_GATEWAY_API_KEY"] || "";
  return { baseUrl: V0_GATEWAY_BASE_URL, apiKey };
}
