import { Env, AgentResponse } from '../types';
import { LLMClient } from '../llm/client';
import { SYSTEM_PROMPTS } from '../llm/prompt-templates';
import { WebSearchTool, SearchResult } from '../tools/web-search';

export class ResearchAgent {
  private llm: LLMClient;
  private webSearch: WebSearchTool;
  
  constructor(private env: Env) {
    this.llm = new LLMClient(env);
    this.webSearch = new WebSearchTool(env);
  }
  
  async execute(query: string, context?: string): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Perform web search
      const searchResults = await this.webSearch.search(query, 3);
      
      let searchContext = '';
      if (searchResults.length > 0) {
        searchContext = 'Web Search Results:\n\n';
        searchResults.forEach((result, index) => {
          searchContext += `${index + 1}. ${result.title}\n`;
          searchContext += `   ${result.snippet}\n`;
          searchContext += `   URL: ${result.url}\n\n`;
        });
      }
      
      const prompt = context 
        ? `Research Query: ${query}\n\nContext: ${context}\n\n${searchContext}\n\nProvide detailed research findings based on the search results.`
        : `Research Query: ${query}\n\n${searchContext}\n\nProvide detailed research findings based on the search results.`;
      
      const response = await this.llm.complete(prompt, {
        systemPrompt: SYSTEM_PROMPTS.research,
        temperature: 0.3,
        maxTokens: 1500
      });
      
      if (!response.success) {
        return response;
      }
      
      return {
        success: true,
        data: {
          findings: response.data,
          sources: searchResults.map(r => ({ title: r.title, url: r.url })),
          summary: this.summarize(response.data),
          searchResultsCount: searchResults.length
        },
        tokensUsed: response.tokensUsed,
        durationMs: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Research agent error',
        durationMs: Date.now() - startTime
      };
    }
  }
  
  private summarize(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.slice(0, 3).join('. ') + '.';
  }
}