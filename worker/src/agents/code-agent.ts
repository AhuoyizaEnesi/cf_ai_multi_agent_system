import { Env, AgentResponse } from '../types';
import { LLMClient } from '../llm/client';
import { SYSTEM_PROMPTS } from '../llm/prompt-templates';

export class CodeAgent {
  private llm: LLMClient;
  
  constructor(private env: Env) {
    this.llm = new LLMClient(env);
  }
  
  async execute(requirements: string, language: string = 'python'): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Detect language from requirements
      const detectedLanguage = this.detectLanguage(requirements);
      
      const prompt = `Language: ${detectedLanguage}\n\nRequirements:\n${requirements}\n\nGenerate a clean, well-commented ${detectedLanguage} code example only. Do not provide examples in any other language. Include only essential comments and error handling.`;
      
      const response = await this.llm.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.code,
        temperature: 0.2,
        maxTokens: 2000
      });
      
      if (!response.success) {
        return response;
      }
      
      const code = this.extractCode(response.data);
      
      return {
        success: true,
        data: {
          code,
          language: detectedLanguage,
          explanation: this.extractExplanation(response.data),
          complexity: this.estimateComplexity(code)
        },
        tokensUsed: response.tokensUsed,
        durationMs: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Code agent error',
        durationMs: Date.now() - startTime
      };
    }
  }
  
  private detectLanguage(requirements: string): string {
    const lower = requirements.toLowerCase();
    if (lower.includes('python')) return 'python';
    if (lower.includes('typescript') || lower.includes('ts')) return 'typescript';
    if (lower.includes('javascript') || lower.includes('js')) return 'javascript';
    if (lower.includes('rust')) return 'rust';
    if (lower.includes('go')) return 'go';
    if (lower.includes('java')) return 'java';
    if (lower.includes('c++') || lower.includes('cpp')) return 'cpp';
    if (lower.includes('c#') || lower.includes('csharp')) return 'csharp';
    return 'python';
  }
  
  private extractCode(text: string): string {
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
    const matches = text.match(codeBlockRegex);
    
    if (matches && matches.length > 0) {
      return matches[0].replace(/```[\w]*\n/, '').replace(/```$/, '').trim();
    }
    
    return text;
  }
  
  private extractExplanation(text: string): string {
    const lines = text.split('\n');
    const explanation: string[] = [];
    
    for (const line of lines) {
      if (!line.trim().startsWith('```') && !line.trim().startsWith('//')) {
        explanation.push(line);
      }
    }
    
    return explanation.join('\n').trim();
  }
  
  private estimateComplexity(code: string): string {
    const lines = code.split('\n').length;
    const loops = (code.match(/for|while|forEach/g) || []).length;
    const conditionals = (code.match(/if|switch|case/g) || []).length;
    
    const score = lines + (loops * 2) + conditionals;
    
    if (score < 20) return 'low';
    if (score < 50) return 'medium';
    return 'high';
  }
}