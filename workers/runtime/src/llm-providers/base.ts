/**
 * Base interface for LLM providers.
 * All providers must implement this interface to work with OpenChief.
 */

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model?: string;
  provider?: string;
}

export interface LLMProviderConfig {
  /** Provider type */
  type: "anthropic" | "openai-codex" | "gemini" | "glm" | "custom";
  
  /** API key (for API-based providers) */
  apiKey?: string;
  
  /** OAuth credentials (for OAuth-based providers) */
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    accessToken?: string;
  };
  
  /** CLI path (for CLI-based providers) */
  cliPath?: string;
  
  /** Default model */
  model?: string;
  
  /** Additional provider-specific config */
  custom?: Record<string, unknown>;
}

export interface LLMCallOptions {
  /** Override default model */
  model?: string;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Temperature (0-1) */
  temperature?: number;
  
  /** Extended context mode */
  extendedContext?: boolean;
  
  /** Timeout in milliseconds */
  timeout?: number;
}

export abstract class LLMProvider {
  protected config: LLMProviderConfig;
  
  constructor(config: LLMProviderConfig) {
    this.config = config;
  }
  
  /**
   * Call the LLM with a system prompt and messages.
   */
  abstract call(
    systemPrompt: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse>;
  
  /**
   * Validate provider configuration and credentials.
   */
  abstract validate(): Promise<boolean>;
  
  /**
   * Get provider display name.
   */
  abstract getName(): string;
  
  /**
   * Get available models for this provider.
   */
  abstract getAvailableModels(): Promise<string[]>;
}
