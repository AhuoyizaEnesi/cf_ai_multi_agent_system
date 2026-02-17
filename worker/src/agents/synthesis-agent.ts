import { Env, AgentResponse, AgentTask } from '../types';
import { LLMClient } from '../llm/client';
import { SYSTEM_PROMPTS } from '../llm/prompt-templates';

export class SynthesisAgent {
  private llm: LLMClient;
  
  constructor(private env: Env) {
    this.llm = new LLMClient(env);
  }
  
  async execute(userQuery: string, agentResults: AgentTask[]): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      const resultsText = agentResults
        .filter(task => task.status === 'completed' && task.result)
        .map(task => {
          let taskData = task.result;
          try {
            const parsed = JSON.parse(task.result || '{}');
            if (task.type === 'code' && parsed.code) {
              taskData = `Code (${parsed.language || 'text'}):\n\`\`\`${parsed.language || 'python'}\n${parsed.code}\n\`\`\`\n\nExplanation: ${parsed.explanation || ''}`;
            } else {
              taskData = JSON.stringify(parsed, null, 2);
            }
          } catch {
            taskData = task.result || '';
          }
          return `${task.type.toUpperCase()} Agent Result:\n${taskData}`;
        })
        .join('\n\n---\n\n');
      
      const prompt = `Original User Query: ${userQuery}\n\nAgent Results:\n${resultsText}\n\nSynthesize these results into a well-formatted markdown response. If there is code, wrap it in markdown code blocks with the language specified (e.g., \`\`\`python). Keep the response concise and well-structured.`;
      
      const response = await this.llm.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.synthesis,
        temperature: 0.6,
        maxTokens: 2000
      });
      
      if (!response.success) {
        return response;
      }
      
      return {
        success: true,
        data: {
          synthesized: response.data,
          sourcesUsed: agentResults.map(t => t.type),
          completeness: this.assessCompleteness(agentResults)
        },
        tokensUsed: response.tokensUsed,
        durationMs: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Synthesis agent error',
        durationMs: Date.now() - startTime
      };
    }
  }
  
  private assessCompleteness(tasks: AgentTask[]): number {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return completed / total;
  }
}