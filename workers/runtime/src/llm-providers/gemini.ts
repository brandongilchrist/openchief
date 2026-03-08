/**
 * Google Gemini CLI provider.
 * Uses the google-gemini-cli installed locally (subscription-based).
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProviderConfig } from "./base";
import { LLMProvider } from "./base";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class GeminiProvider extends LLMProvider {
  private defaultModel = "gemini-3-pro-preview";
  private cliCommand: string;
  
  constructor(config: LLMProviderConfig) {
    super(config);
    this.cliCommand = config.cliPath || "gemini";
    if (config.model) {
      this.defaultModel = config.model;
    }
  }
  
  async call(
    systemPrompt: string,
    messages: LLMMessage[],
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const model = options?.model || this.config.model || this.defaultModel;
    const maxTokens = options?.maxTokens || 8192;
    
    // Build the full prompt (system + conversation)
    let fullPrompt = systemPrompt + "\n\n";
    for (const msg of messages) {
      if (msg.role === "system") {
        fullPrompt += msg.content + "\n\n";
      } else if (msg.role === "user") {
        fullPrompt += "User: " + msg.content + "\n\n";
      } else if (msg.role === "assistant") {
        fullPrompt += "Assistant: " + msg.content + "\n\n";
      }
    }
    fullPrompt += "Assistant:";
    
    // Call Gemini CLI
    // Format: gemini "prompt" [--model model] [--max-tokens N]
    const args = [
      `"${fullPrompt.replace(/"/g, '\\"')}"`,
      `--model ${model}`,
      `--max-tokens ${maxTokens}`,
    ];
    
    if (options?.temperature !== undefined) {
      args.push(`--temperature ${options.temperature}`);
    }
    
    const command = `${this.cliCommand} ${args.join(" ")}`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: options?.timeout || 120000, // 2min default
      });
      
      if (stderr && !stderr.includes("WARNING")) {
        console.error("Gemini CLI stderr:", stderr);
      }
      
      // Parse output (gemini CLI returns JSON)
      const result = JSON.parse(stdout.trim());
      
      return {
        text: result.text || result.response || stdout.trim(),
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
        model,
        provider: "gemini",
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini CLI error: ${error.message}`);
      }
      throw error;
    }
  }
  
  async validate(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.cliCommand} --version`);
      return stdout.includes("gemini") || stdout.includes("google");
    } catch {
      return false;
    }
  }
  
  getName(): string {
    return "Google Gemini CLI";
  }
  
  async getAvailableModels(): Promise<string[]> {
    return [
      "gemini-3-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ];
  }
}
