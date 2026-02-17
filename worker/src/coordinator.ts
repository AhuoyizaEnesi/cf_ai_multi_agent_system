import { DurableObject } from 'cloudflare:workers';
import { Env, Message, AgentTask, ConversationContext, StreamChunk } from './types';
import { generateId } from './utils/helpers';
import { LLMClient } from './llm/client';
import { SYSTEM_PROMPTS, buildTaskPrompt } from './llm/prompt-templates';
import { D1Store } from './memory/d1-store';
import { KVCache } from './memory/kv-cache';
import { VectorizeStore } from './memory/vectorize-store';
import { ResearchAgent } from './agents/research-agent';
import { AnalysisAgent } from './agents/analysis-agent';
import { CodeAgent } from './agents/code-agent';
import { SynthesisAgent } from './agents/synthesis-agent';

export class CoordinatorDO extends DurableObject {
  private sessions: Map<WebSocket, string> = new Map();
  private context: ConversationContext | null = null;
  private llm: LLMClient;
  private db: D1Store;
  private cache: KVCache;
  private vectorStore: VectorizeStore;
  private agents: {
    research: ResearchAgent;
    analysis: AnalysisAgent;
    code: CodeAgent;
    synthesis: SynthesisAgent;
  };
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.llm = new LLMClient(env);
    this.db = new D1Store(env);
    this.cache = new KVCache(env);
    this.vectorStore = new VectorizeStore(env);
    this.agents = {
      research: new ResearchAgent(env),
      analysis: new AnalysisAgent(env),
      code: new CodeAgent(env),
      synthesis: new SynthesisAgent(env)
    };
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      this.ctx.acceptWebSocket(server);
      const sessionId = generateId('session');
      this.sessions.set(server, sessionId);
      
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }
    
    if (url.pathname === '/init' && request.method === 'POST') {
      const { userId } = await request.json() as { userId: string };
      const conversationId = await this.db.createConversation(userId);
      
      this.context = {
        conversationId,
        userId,
        messages: [],
        tasks: [],
        metadata: {}
      };
      
      return new Response(JSON.stringify({ conversationId }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const data = JSON.parse(message as string);
      await this.handleMessage(ws, data);
    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.sessions.delete(ws);
  }
  
  private async handleMessage(ws: WebSocket, data: any): Promise<void> {
    if (!this.context) {
      this.sendError(ws, 'No conversation context initialized');
      return;
    }
    
    if (data.type === 'user_message') {
      await this.processUserMessage(ws, data.content);
    }
  }
  
  private async processUserMessage(ws: WebSocket, content: string): Promise<void> {
    if (!this.context) return;
    
    const userMessage: Message = {
      id: generateId('msg'),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    this.context.messages.push(userMessage);
    await this.db.saveMessage(this.context.conversationId, userMessage);
    await this.vectorStore.embedMessage(this.context.conversationId, userMessage);
    
    const tasks = await this.decomposeTasks(content);
    this.context.tasks = tasks;
    
    const agentTasks = tasks.filter(t => t.type !== 'synthesis');
    
    for (const task of agentTasks) {
      this.sendChunk(ws, {
        type: 'agent_start',
        data: { taskId: task.id, agentType: task.type },
        timestamp: Date.now()
      });
    }
    
    const startTime = Date.now();
    await Promise.all(
      agentTasks.map(async (task) => {
        await this.executeTask(task);
        this.sendChunk(ws, {
          type: 'agent_complete',
          data: { taskId: task.id, result: task.result, status: task.status },
          timestamp: Date.now()
        });
      })
    );
    const parallelDuration = Date.now() - startTime;
    
    console.log(`Parallel execution completed in ${parallelDuration}ms`);
    
    const synthesisTask = tasks.find(t => t.type === 'synthesis');
    if (synthesisTask) {
      this.sendChunk(ws, {
        type: 'agent_start',
        data: { taskId: synthesisTask.id, agentType: 'synthesis' },
        timestamp: Date.now()
      });
    }
    
    const synthesisResult = await this.agents.synthesis.execute(
      content,
      agentTasks
    );
    
    if (synthesisTask) {
      this.sendChunk(ws, {
        type: 'agent_complete',
        data: { taskId: synthesisTask.id, result: 'completed', status: 'completed' },
        timestamp: Date.now()
      });
    }
    
    if (synthesisResult.success) {
      const assistantMessage: Message = {
        id: generateId('msg'),
        role: 'assistant',
        content: synthesisResult.data.synthesized,
        timestamp: Date.now(),
        metadata: {
          sourcesUsed: synthesisResult.data.sourcesUsed,
          completeness: synthesisResult.data.completeness,
          parallelExecutionMs: parallelDuration
        }
      };
      
      this.context.messages.push(assistantMessage);
      await this.db.saveMessage(this.context.conversationId, assistantMessage);
      await this.vectorStore.embedMessage(this.context.conversationId, assistantMessage);
      
      await this.streamResponse(ws, synthesisResult.data.synthesized);
    }
    
    this.sendChunk(ws, {
      type: 'done',
      data: { executionTimeMs: parallelDuration },
      timestamp: Date.now()
    });
  }
  
  private async decomposeTasks(userMessage: string): Promise<AgentTask[]> {
    const tasks: AgentTask[] = [];
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('write') || lowerMessage.includes('code') || 
        lowerMessage.includes('function') || lowerMessage.includes('program') ||
        lowerMessage.includes('script') || lowerMessage.includes('implement')) {
      tasks.push({
        id: generateId('task'),
        type: 'code',
        input: userMessage,
        priority: 1,
        status: 'pending'
      });
    }
    
    if (lowerMessage.includes('what are') || lowerMessage.includes('latest') ||
        lowerMessage.includes('trends') || lowerMessage.includes('explain') ||
        lowerMessage.includes('tell me about') || lowerMessage.includes('research')) {
      tasks.push({
        id: generateId('task'),
        type: 'research',
        input: userMessage,
        priority: tasks.length + 1,
        status: 'pending'
      });
    }
    
    if (lowerMessage.includes('analyze') || lowerMessage.includes('pros and cons') ||
        lowerMessage.includes('compare') || lowerMessage.includes('evaluate') ||
        lowerMessage.includes('advantages') || lowerMessage.includes('disadvantages')) {
      tasks.push({
        id: generateId('task'),
        type: 'analysis',
        input: userMessage,
        priority: tasks.length + 1,
        status: 'pending'
      });
    }
    
    tasks.push({
      id: generateId('task'),
      type: 'synthesis',
      input: userMessage,
      priority: tasks.length + 1,
      status: 'pending'
    });
    
    return tasks;
  }
  
  private async executeTask(task: AgentTask): Promise<void> {
    task.status = 'running';
    task.startTime = Date.now();
    
    try {
      let result;
      
      switch (task.type) {
        case 'research':
          result = await this.agents.research.execute(task.input);
          break;
        case 'analysis':
          result = await this.agents.analysis.execute(task.input);
          break;
        case 'code':
          result = await this.agents.code.execute(task.input);
          break;
        case 'synthesis':
          task.status = 'completed';
          task.result = 'Synthesis pending';
          task.endTime = Date.now();
          return;
        default:
          result = { success: false, error: 'Unknown agent type' };
      }
      
      if (result.success) {
        task.result = JSON.stringify(result.data);
        task.status = 'completed';
      } else {
        task.error = result.error;
        task.status = 'failed';
      }
      
      task.endTime = Date.now();
      
      if (this.context) {
        await this.db.saveAgentExecution(
          this.context.conversationId,
          task.type,
          task.input,
          task.result || null,
          result.durationMs || 0,
          result.tokensUsed || 0,
          task.status,
          task.error || null
        );
      }
      
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.endTime = Date.now();
    }
  }
  
  private async streamResponse(ws: WebSocket, text: string): Promise<void> {
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      this.sendChunk(ws, {
        type: 'token',
        data: words[i] + (i < words.length - 1 ? ' ' : ''),
        timestamp: Date.now()
      });
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  private sendChunk(ws: WebSocket, chunk: StreamChunk): void {
    try {
      ws.send(JSON.stringify(chunk));
    } catch (error) {
      console.error('Failed to send chunk:', error);
    }
  }
  
  private sendError(ws: WebSocket, error: string): void {
    this.sendChunk(ws, {
      type: 'error',
      data: { error },
      timestamp: Date.now()
    });
  }
}