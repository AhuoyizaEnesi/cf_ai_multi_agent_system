import { Env, AgentResponse } from '../types';

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export class LLMClient {
  constructor(private env: Env) {}
  
  async complete(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      const messages = [];
      
      if (options.systemPrompt) {
        messages.push({
          role: 'system',
          content: options.systemPrompt
        });
      }
      
      messages.push({
        role: 'user',
        content: prompt
      });
      
      const response = await this.env.AI.run(
        options.model || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        {
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2048,
          stream: options.stream || false
        }
      );
      
      const durationMs = Date.now() - startTime;
      
      if (options.stream) {
        return {
          success: true,
          data: response,
          durationMs
        };
      }
      
      return {
        success: true,
        data: response.response,
        durationMs,
        tokensUsed: this.estimateTokens(prompt + (response.response || ''))
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown LLM error',
        durationMs: Date.now() - startTime
      };
    }
  }
  
  async streamComplete(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<ReadableStream> {
    const messages = [];
    
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }
    
    messages.push({
      role: 'user',
      content: prompt
    });
    
    const stream = await this.env.AI.run(
      options.model || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      {
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2048,
        stream: true
      }
    );
    
    return stream;
  }
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}