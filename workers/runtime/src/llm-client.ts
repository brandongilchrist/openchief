/**
 * Unified LLM client that routes to the appropriate provider.
 * Replaces claude-client.ts with multi-provider support.
 */

import { createProvider, type LLMProviderConfig } from "./llm-providers";

/**
 * Get the active LLM provider from environment.
 */
function getProviderConfig(env: {
  ANTHROPIC_API_KEY?: string;
  LLM_PROVIDER_TYPE?: string;
  LLM_PROVIDER_CONFIG?: string;
}): LLMProviderConfig {
  // Check if custom provider is configured
  if (env.LLM_PROVIDER_TYPE && env.LLM_PROVIDER_CONFIG) {
    try {
      const config = JSON.parse(env.LLM_PROVIDER_CONFIG);
      return {
        type: env.LLM_PROVIDER_TYPE as any,
        ...config,
      };
    } catch (error) {
      console.error("Failed to parse LLM_PROVIDER_CONFIG:", error);
    }
  }
  
  // Default to Anthropic with API key
  return {
    type: "anthropic",
    apiKey: env.ANTHROPIC_API_KEY,
  };
}

/**
 * Call the configured LLM provider.
 * 
 * This is the main entry point for all LLM calls in OpenChief.
 * It routes to the appropriate provider based on configuration.
 */
export async function callLLM(
  env: {
    ANTHROPIC_API_KEY?: string;
    LLM_PROVIDER_TYPE?: string;
    LLM_PROVIDER_CONFIG?: string;
  },
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  model?: string,
  maxTokens = 8192,
  options?: { extendedContext?: boolean; temperature?: number }
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const config = getProviderConfig(env);
  const provider = createProvider(config);
  
  return await provider.call(systemPrompt, messages, {
    model,
    maxTokens,
    temperature: options?.temperature,
    extendedContext: options?.extendedContext,
  });
}

/**
 * Backwards compatibility: export as callClaude for existing code.
 */
export const callClaude = callLLM;
