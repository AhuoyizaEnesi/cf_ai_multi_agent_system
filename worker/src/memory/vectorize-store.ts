import { Env, Message } from '../types';
import { generateId } from '../utils/helpers';

export interface VectorDocument {
  id: string;
  text: string;
  metadata: {
    conversationId: string;
    messageId: string;
    role: string;
    timestamp: number;
  };
}

export class VectorizeStore {
  constructor(private env: Env) {}
  
  async embedMessage(conversationId: string, message: Message): Promise<void> {
    try {
      // Generate embedding using Workers AI
      const embedding = await this.env.AI.run(
        '@cf/baai/bge-base-en-v1.5',
        {
          text: message.content
        }
      );
      
      if (!embedding || !embedding.data || !embedding.data[0]) {
        console.error('Failed to generate embedding');
        return;
      }
      
      const vectorId = generateId('vec');
      
      // Insert into Vectorize
      await this.env.VECTORIZE.insert([
        {
          id: vectorId,
          values: embedding.data[0],
          metadata: {
            conversationId,
            messageId: message.id,
            role: message.role,
            timestamp: message.timestamp,
            content: message.content.substring(0, 500) // Store truncated content
          }
        }
      ]);
      
    } catch (error) {
      console.error('Vector embedding error:', error);
    }
  }
  
  async searchSimilar(query: string, limit: number = 5): Promise<VectorDocument[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.env.AI.run(
        '@cf/baai/bge-base-en-v1.5',
        {
          text: query
        }
      );
      
      if (!queryEmbedding || !queryEmbedding.data || !queryEmbedding.data[0]) {
        console.error('Failed to generate query embedding');
        return [];
      }
      
      // Search Vectorize
      const results = await this.env.VECTORIZE.query(queryEmbedding.data[0], {
        topK: limit,
        returnMetadata: true
      });
      
      if (!results || !results.matches) {
        return [];
      }
      
      return results.matches.map(match => ({
        id: match.id,
        text: match.metadata?.content as string || '',
        metadata: {
          conversationId: match.metadata?.conversationId as string || '',
          messageId: match.metadata?.messageId as string || '',
          role: match.metadata?.role as string || 'user',
          timestamp: match.metadata?.timestamp as number || 0
        }
      }));
      
    } catch (error) {
      console.error('Vector search error:', error);
      return [];
    }
  }
  
  async getConversationContext(conversationId: string, limit: number = 10): Promise<VectorDocument[]> {
    try {
      // Note: Vectorize doesn't support metadata filtering in query yet
      // So we'll search and filter results
      const allResults = await this.env.VECTORIZE.query(
        new Array(768).fill(0), // Dummy vector
        {
          topK: 100,
          returnMetadata: true
        }
      );
      
      if (!allResults || !allResults.matches) {
        return [];
      }
      
      const filtered = allResults.matches
        .filter(match => match.metadata?.conversationId === conversationId)
        .slice(0, limit)
        .map(match => ({
          id: match.id,
          text: match.metadata?.content as string || '',
          metadata: {
            conversationId: match.metadata?.conversationId as string || '',
            messageId: match.metadata?.messageId as string || '',
            role: match.metadata?.role as string || 'user',
            timestamp: match.metadata?.timestamp as number || 0
          }
        }));
      
      return filtered;
      
    } catch (error) {
      console.error('Get conversation context error:', error);
      return [];
    }
  }
}