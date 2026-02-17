export interface Env {
  COORDINATOR: DurableObjectNamespace;
  DB: D1Database;
  CACHE: KVNamespace;
  VECTORIZE: VectorizeIndex;
  AI: any;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AgentTask {
  id: string;
  type: 'research' | 'analysis' | 'code' | 'synthesis';
  input: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface ConversationContext {
  conversationId: string;
  userId: string;
  messages: Message[];
  tasks: AgentTask[];
  metadata: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed?: number;
  durationMs?: number;
}

export interface StreamChunk {
  type: 'token' | 'agent_start' | 'agent_complete' | 'error' | 'done';
  data: any;
  timestamp: number;
}