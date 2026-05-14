export type Provider = "openai" | "anthropic" | "gemini" | "openrouter";

export interface ModelEntry {
  id: string;
  provider: Provider;
  created: number;
}

export const MODEL_REGISTRY: ModelEntry[] = [
  { id: "gpt-4.1",            provider: "openai", created: 1744934400 },
  { id: "gpt-4.1-mini",       provider: "openai", created: 1744934400 },
  { id: "gpt-4.1-nano",       provider: "openai", created: 1744934400 },
  { id: "gpt-4o",             provider: "openai", created: 1715904000 },
  { id: "gpt-4o-mini",        provider: "openai", created: 1721260800 },
  { id: "o4-mini",            provider: "openai", created: 1744934400 },
  { id: "o3",                 provider: "openai", created: 1741392000 },
  { id: "o3-mini",            provider: "openai", created: 1738281600 },

  { id: "claude-opus-4-5",        provider: "anthropic", created: 1751328000 },
  { id: "claude-sonnet-4-5",      provider: "anthropic", created: 1751328000 },
  { id: "claude-haiku-4-5",       provider: "anthropic", created: 1751328000 },

  { id: "gemini-2.5-pro",         provider: "gemini", created: 1748995200 },
  { id: "gemini-2.5-flash",       provider: "gemini", created: 1747699200 },

  { id: "openai/gpt-5.4-image-2",        provider: "openrouter", created: 1751328000 },
  { id: "bytedance-seed/seedream-4.5",   provider: "openrouter", created: 1747180800 },
  { id: "bytedance/seedance-2.0",        provider: "openrouter", created: 1747180800 },
  { id: "kwaivgi/kling-v3.0-pro",        provider: "openrouter", created: 1747180800 },
  { id: "x-ai/grok-4-fast",             provider: "openrouter", created: 1748995200 },
  { id: "meta-llama/llama-4-maverick",   provider: "openrouter", created: 1744934400 },
  { id: "meta-llama/llama-4-scout",      provider: "openrouter", created: 1744934400 },
  { id: "deepseek/deepseek-r1",          provider: "openrouter", created: 1737158400 },
  { id: "google/gemini-2.5-pro",         provider: "openrouter", created: 1748995200 },
  { id: "anthropic/claude-opus-4.6",     provider: "openrouter", created: 1753142400 },
  { id: "anthropic/claude-sonnet-4.6",   provider: "openrouter", created: 1753142400 },
];

const DEFAULT_MODEL = "gpt-4.1-mini";

export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

export function resolveProvider(modelId: string): Provider | null {
  const entry = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (entry) return entry.provider;
  if (modelId.includes("/")) return "openrouter";
  return null;
}

let _disabledModels: Set<string> = new Set();

export function isModelDisabled(id: string): boolean {
  return _disabledModels.has(id);
}

export function patchModelDisabled(id: string, disabled: boolean): void {
  if (disabled) {
    _disabledModels.add(id);
  } else {
    _disabledModels.delete(id);
  }
}

export function getEnabledModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => !_disabledModels.has(m.id));
}

export function getAllModelsWithStatus(): Array<ModelEntry & { disabled: boolean }> {
  return MODEL_REGISTRY.map((m) => ({ ...m, disabled: _disabledModels.has(m.id) }));
}
