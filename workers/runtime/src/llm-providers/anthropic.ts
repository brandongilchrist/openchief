/**
 * Anthropic/Claude provider with OAuth and API key support.
 * Supports both subscription-based OAuth and API key authentication.
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProviderConfig } from "./base";
import { LLMProvider } from "./base";

/** Sanitize Unicode: remove lone surrogates that break JSON.stringify */
function sanitizeUnicode(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

export class AnthropicProvider extends LLMProvider {
  private defaultModel = "claude-sonnet-4-6";
  
  constructor(config: LLMProviderConfig) {
    super(config);
    if (config.model) {
      this.defaultModel = config.model;
    }
  }
  
  async call(
    systemPrompt: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const apiKey = await this.getApiKey();
    const model = options?.model || this.config.model || this.defaultModel;
    const maxTokens = options?.maxTokens || 8192;
    
    // Convert messages to Anthropic format (no system role)
    const anthropicMessages = messages.map(m => ({
      role: m.role === "system" ? "user" : m.role,
      content: m.content
    }));
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        system: systemPrompt,
        messages: anthropicMessages,
        temperature: options?.temperature,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }
    
    if (!response.body) {
      throw new Error("Anthropic API returned no response body");
    }
    
    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let inputTokens = 0;
    let outputTokens = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        
        try {
          const event = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text?: string };
            message?: { usage?: { input_tokens: number; output_tokens: number } };
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          
          if (event.type === "content_block_delta" && event.delta?.text) {
            fullText += event.delta.text;
          } else if (event.type === "message_start" && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens || 0;
          } else if (event.type === "message_delta" && event.usage) {
            outputTokens = event.usage.output_tokens || 0;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
    
    return {
      text: sanitizeUnicode(fullText),
      inputTokens,
      outputTokens,
      model,
      provider: "anthropic",
    };
  }
  
  private async getApiKey(): Promise<string> {
    // Try OAuth first if configured
    if (this.config.oauth?.refreshToken) {
      return await this.refreshOAuthToken();
    }
    
    // Fall back to API key
    if (!this.config.apiKey) {
      throw new Error("Anthropic provider requires either apiKey or OAuth configuration");
    }
    
    return this.config.apiKey;
  }
  
  private async refreshOAuthToken(): Promise<string> {
    if (!this.config.oauth?.refreshToken) {
      throw new Error("No refresh token configured for Anthropic OAuth");
    }
    
    // Check if we have a valid access token
    if (this.config.oauth.accessToken) {
      // TODO: Add token expiry checking
      return this.config.oauth.accessToken;
    }
    
    // Refresh the token
    // Note: Anthropic doesn't have public OAuth yet, this is a placeholder for when they do
    throw new Error("Anthropic OAuth not yet implemented - use API key");
  }
  
  async validate(): Promise<boolean> {
    try {
      const response = await this.call(
        "You are a helpful assistant. Say 'OK' and nothing else.",
        [{ role: "user", content: "Test" }],
        { maxTokens: 10 }
      );
      return response.text.length > 0;
    } catch {
      return false;
    }
  }
  
  getName(): string {
    return "Anthropic Claude";
  }
  
  async getAvailableModels(): Promise<string[]> {
    return [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-sonnet-4-5",
      "claude-haiku-4",
    ];
  }
}
