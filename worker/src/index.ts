import { Env } from './types';
import { CoordinatorDO } from './coordinator';

export { CoordinatorDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
      return new Response('Multi-Agent System API', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (url.pathname === '/api/conversation/new') {
      const userId = url.searchParams.get('userId') || 'anonymous';
      const id = env.COORDINATOR.newUniqueId();
      const stub = env.COORDINATOR.get(id);
      
      const response = await stub.fetch(new Request('http://do/init', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        headers: { 'Content-Type': 'application/json' }
      }));
      
      const { conversationId } = await response.json() as { conversationId: string };
      
      return new Response(JSON.stringify({
        conversationId,
        doId: id.toString()
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    if (url.pathname === '/api/ws') {
      const doIdParam = url.searchParams.get('doId');
      if (!doIdParam) {
        return new Response('Missing doId parameter', { status: 400 });
      }
      
      const id = env.COORDINATOR.idFromString(doIdParam);
      const stub = env.COORDINATOR.get(id);
      
      return stub.fetch(new Request('http://do/websocket', {
        headers: request.headers
      }));
    }
    
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
};