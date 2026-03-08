/**
 * OpenAI Codex CLI provider.
 * Uses the openai-codex CLI installed locally (subscription-based).
 */

import type { LLMMessage, LLMResponse, LLMCallOptions, LLMProviderConfig } from "./base";
import { LLMProvider } from "./base";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class OpenAICodexProvider extends LLMProvider {
  private defaultModel = "gpt-5.2-codex-mini";
  private cliCommand: string;
  
  constructor(config: LLMProviderConfig) {
    super(config);
    this.cliCommand = config.cliPath || "codex";
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
    
    // Build messages file (codex CLI uses JSON messages format)
    const messagesPayload = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
    
    // Write messages to temp file
    const tempFile = `/tmp/openchief-codex-${Date.now()}.json`;
    await Bun.write(tempFile, JSON.stringify(messagesPayload));
    
    try {
      // Call Codex CLI
      // Format: codex --messages-file file.json [--model model] [--max-tokens N]
      const args = [
        `--messages-file ${tempFile}`,
        `--model ${model}`,
        `--max-tokens ${maxTokens}`,
        `--json`, // Request JSON output
      ];
      
      if (options?.temperature !== undefined) {
        args.push(`--temperature ${options.temperature}`);
      }
      
      const command = `${this.cliCommand} ${args.join(" ")}`;
      
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: options?.timeout || 120000, // 2min default
      });
      
      if (stderr && !stderr.includes("WARNING")) {
        console.error("Codex CLI stderr:", stderr);
      }
      
      // Parse output
      const result = JSON.parse(stdout.trim());
      
      return {
        text: result.text || result.response || result.content || stdout.trim(),
        inputTokens: result.usage?.prompt_tokens || result.inputTokens || 0,
        outputTokens: result.usage?.completion_tokens || result.outputTokens || 0,
        model,
        provider: "openai-codex",
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI Codex CLI error: ${error.message}`);
      }
      throw error;
    } finally {
      // Clean up temp file
      try {
        await execAsync(`rm ${tempFile}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
  
  async validate(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`${this.cliCommand} --version`);
      return stdout.includes("codex") || stdout.includes("openai");
    } catch {
      return false;
    }
  }
  
  getName(): string {
    return "OpenAI Codex CLI";
  }
  
  async getAvailableModels(): Promise<string[]> {
    return [
      "gpt-5.2-codex-mini",
      "gpt-5.2-codex-full",
      "gpt-5.2",
      "gpt-5.1-codex-mini",
    ];
  }
}
