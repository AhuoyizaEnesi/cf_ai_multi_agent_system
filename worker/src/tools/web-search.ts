import { Env } from '../types';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export class WebSearchTool {
  constructor(private env: Env) {}
  
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
      );
      
      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}`);
      }
      
      const data = await response.json() as any;
      const results: SearchResult[] = [];
      
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.substring(0, 100),
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        }
      }
      
      if (results.length === 0 && data.Abstract) {
        results.push({
          title: query,
          url: data.AbstractURL || '',
          snippet: data.Abstract
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Web search error:', error);
      return [];
    }
  }
  
  async fetchPage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MultiAgentBot/1.0)'
        }
      });
      
      if (!response.ok) {
        return null;
      }
      
      const html = await response.text();
      
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return text.substring(0, 2000);
      
    } catch (error) {
      console.error('Page fetch error:', error);
      return null;
    }
  }
}