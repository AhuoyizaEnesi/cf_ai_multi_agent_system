import { Env, AgentResponse } from '../types';
import { LLMClient } from '../llm/client';
import { SYSTEM_PROMPTS } from '../llm/prompt-templates';

export class AnalysisAgent {
  private llm: LLMClient;
  
  constructor(private env: Env) {
    this.llm = new LLMClient(env);
  }
  
  async execute(data: string, analysisType: string = 'general'): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      const prompt = `Analysis Type: ${analysisType}\n\nData to Analyze:\n${data}\n\nProvide detailed analysis including patterns, insights, and conclusions.`;
      
      const response = await this.llm.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.analysis,
        temperature: 0.4,
        maxTokens: 1500
      });
      
      if (!response.success) {
        return response;
      }
      
      return {
        success: true,
        data: {
          analysis: response.data,
          insights: this.extractInsights(response.data),
          confidence: this.calculateConfidence(response.data)
        },
        tokensUsed: response.tokensUsed,
        durationMs: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis agent error',
        durationMs: Date.now() - startTime
      };
    }
  }
  
  private extractInsights(text: string): string[] {
    const insights: string[] = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      if (line.includes('insight') || line.includes('pattern') || line.includes('conclusion')) {
        insights.push(line.trim());
      }
    }
    
    return insights.slice(0, 5);
  }
  
  private calculateConfidence(text: string): number {
    const uncertainWords = ['might', 'maybe', 'possibly', 'perhaps', 'unclear', 'uncertain'];
    const certainWords = ['clearly', 'definitely', 'certainly', 'obviously', 'evidently'];
    
    let score = 0.5;
    const lowerText = text.toLowerCase();
    
    for (const word of certainWords) {
      if (lowerText.includes(word)) score += 0.1;
    }
    
    for (const word of uncertainWords) {
      if (lowerText.includes(word)) score -= 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }
}