/**
 * LLM Provider factory and exports.
 * Creates provider instances based on configuration.
 */

export { LLMProvider, type LLMMessage, type LLMResponse, type LLMCallOptions, type LLMProviderConfig } from "./base";
export { AnthropicProvider } from "./anthropic";
export { GeminiProvider } from "./gemini";
export { OpenAICodexProvider } from "./openai-codex";
export { GLMProvider } from "./glm";

import type { LLMProviderConfig } from "./base";
import { LLMProvider } from "./base";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAICodexProvider } from "./openai-codex";
import { GLMProvider } from "./glm";

/**
 * Create an LLM provider instance from configuration.
 */
export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case "anthropic":
      return new AnthropicProvider(config);
    
    case "gemini":
      return new GeminiProvider(config);
    
    case "openai-codex":
      return new OpenAICodexProvider(config);
    
    case "glm":
      return new GLMProvider(config);
    
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

/**
 * Validate a provider configuration.
 */
export async function validateProvider(config: LLMProviderConfig): Promise<boolean> {
  try {
    const provider = createProvider(config);
    return await provider.validate();
  } catch {
    return false;
  }
}

/**
 * Get available models for a provider type.
 */
export async function getAvailableModels(type: string): Promise<string[]> {
  const dummyConfig: LLMProviderConfig = { type: type as any };
  try {
    const provider = createProvider(dummyConfig);
    return await provider.getAvailableModels();
  } catch {
    return [];
  }
}
