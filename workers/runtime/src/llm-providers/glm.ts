/**
 * Z.ai GLM-5 provider.
 * Uses Z.ai API (subscription-based with API key).
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProviderConfig } from "./base";
import { LLMProvider } from "./base";

export class GLMProvider extends LLMProvider {
  private defaultModel = "glm-5";
  private baseUrl = "https://api.zai.chat/v1";
  
  constructor(config: LLMProviderConfig) {
    super(config);
    if (config.model) {
      this.defaultModel = config.model;
    }
    if (config.custom?.baseUrl) {
      this.baseUrl = config.custom.baseUrl as string;
    }
  }
  
  async call(
    systemPrompt: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error("GLM provider requires an API key");
    }
    
    const model = options?.model || this.config.model || this.defaultModel;
    const maxTokens = options?.maxTokens || 8192;
    
    // Build messages array (GLM uses OpenAI-compatible format)
    const glmMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: glmMessages,
        max_tokens: maxTokens,
        temperature: options?.temperature,
        stream: false, // GLM supports streaming but we'll use non-streaming for simplicity
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GLM API error (${response.status}): ${error}`);
    }
    
    const result = await response.json() as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      model: string;
    };
    
    if (!result.choices || result.choices.length === 0) {
      throw new Error("GLM API returned no choices");
    }
    
    return {
      text: result.choices[0].message.content,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
      model: result.model || model,
      provider: "glm",
    };
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
    return "Z.ai GLM";
  }
  
  async getAvailableModels(): Promise<string[]> {
    return [
      "glm-5",
      "glm-4.7",
      "glm-4.6v",
    ];
  }
}
