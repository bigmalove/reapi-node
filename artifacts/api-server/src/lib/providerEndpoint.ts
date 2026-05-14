export type ProviderName = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderEndpoint {
  baseUrl: string;
  apiKey: string;
}

const ENV_BY_PROVIDER: Record<ProviderName, { baseUrl: string; apiKey: string }> = {
  openai:     { baseUrl: "AI_INTEGRATIONS_OPENAI_BASE_URL",     apiKey: "AI_INTEGRATIONS_OPENAI_API_KEY" },
  anthropic:  { baseUrl: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",  apiKey: "AI_INTEGRATIONS_ANTHROPIC_API_KEY" },
  gemini:     { baseUrl: "AI_INTEGRATIONS_GEMINI_BASE_URL",     apiKey: "AI_INTEGRATIONS_GEMINI_API_KEY" },
  openrouter: { baseUrl: "AI_INTEGRATIONS_OPENROUTER_BASE_URL", apiKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY" },
};

export function resolveProviderEndpoint(provider: ProviderName): ProviderEndpoint {
  const envKeys = ENV_BY_PROVIDER[provider];
  const baseUrl = process.env[envKeys.baseUrl];
  const apiKey = process.env[envKeys.apiKey];
  if (!baseUrl || !apiKey) {
    throw new Error(
      `Provider "${provider}" is not configured. Set ${envKeys.baseUrl} and ${envKeys.apiKey}.`,
    );
  }
  return { baseUrl, apiKey };
}
