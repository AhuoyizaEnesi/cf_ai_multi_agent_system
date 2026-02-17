import { Env, Message, ConversationContext } from '../types';
import { generateId } from '../utils/helpers';

export class D1Store {
  constructor(private env: Env) {}
  
  async createConversation(userId: string): Promise<string> {
    const conversationId = generateId('conv');
    const now = Date.now();
    
    await this.env.DB.prepare(
      'INSERT INTO conversations (id, user_id, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?)'
    ).bind(conversationId, userId, now, now, '{}').run();
    
    return conversationId;
  }
  
  async saveMessage(conversationId: string, message: Message): Promise<void> {
    await this.env.DB.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      message.id,
      conversationId,
      message.role,
      message.content,
      message.timestamp,
      JSON.stringify(message.metadata || {})
    ).run();
    
    await this.env.DB.prepare(
      'UPDATE conversations SET updated_at = ? WHERE id = ?'
    ).bind(Date.now(), conversationId).run();
  }
  
  async getMessages(conversationId: string, limit: number = 50): Promise<Message[]> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(conversationId, limit).all();
    
    if (!result.results) return [];
    
    return result.results.map(row => ({
      id: row.id as string,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content as string,
      timestamp: row.created_at as number,
      metadata: JSON.parse(row.metadata as string || '{}')
    })).reverse();
  }
  
  async saveAgentExecution(
    conversationId: string,
    agentType: string,
    input: string,
    output: string | null,
    durationMs: number,
    tokensUsed: number,
    status: string,
    error: string | null
  ): Promise<void> {
    const id = generateId('exec');
    
    await this.env.DB.prepare(
      `INSERT INTO agent_executions 
       (id, conversation_id, agent_type, input, output, duration_ms, tokens_used, created_at, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      conversationId,
      agentType,
      input,
      output,
      durationMs,
      tokensUsed,
      Date.now(),
      status,
      error
    ).run();
  }
  
  async getConversationContext(conversationId: string): Promise<ConversationContext | null> {
    const convResult = await this.env.DB.prepare(
      'SELECT * FROM conversations WHERE id = ?'
    ).bind(conversationId).first();
    
    if (!convResult) return null;
    
    const messages = await this.getMessages(conversationId);
    
    return {
      conversationId,
      userId: convResult.user_id as string,
      messages,
      tasks: [],
      metadata: JSON.parse(convResult.metadata as string || '{}')
    };
  }
}