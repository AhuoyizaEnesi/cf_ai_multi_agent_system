import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Bot, User, CheckCircle, Moon, Sun, ChevronDown, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CodeCanvas } from './components/CodeCanvas';
import './App.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  agentsUsed?: string[];
  codeBlocks?: Array<{id: string, code: string, language: string}>;
}

interface AgentActivity {
  taskId: string;
  agentType: string;
  status: 'running' | 'completed' | 'failed';
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [codeCanvases, setCodeCanvases] = useState<Array<{id: string, code: string, language: string}>>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentResponseRef = useRef<string>('');
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAgentsRef = useRef<string[]>([]);

  const WORKER_URL = 'https://multi-agent-system.penesi.workers.dev';

  useEffect(() => {
    initializeConversation();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom && !isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (!isNearBottom) {
      isUserScrollingRef.current = true;
      setShowScrollButton(true);
    } else {
      isUserScrollingRef.current = false;
      setShowScrollButton(false);
    }
  };

  const initializeConversation = async () => {
    try {
      const res = await fetch(`${WORKER_URL}/api/conversation/new?userId=user-${Date.now()}`);
      const data = await res.json();
      connectWebSocket(data.doId);
    } catch (error) {
      console.error('Failed to initialize:', error);
    }
  };

  const connectWebSocket = (doId: string) => {
    const wsUrl = WORKER_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/ws?doId=${doId}`);
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => handleStreamChunk(JSON.parse(event.data));
    ws.onclose = () => setIsConnected(false);
    ws.onerror = (e) => console.error('WS error:', e);
    wsRef.current = ws;
  };

  const extractCodeBlocks = (text: string) => {
    const regex = /```(\w+)?[\r\n]+([\s\S]*?)```/g;
    return [...text.matchAll(regex)].map((m, i) => ({
      id: `code-${Date.now()}-${i}`,
      language: m[1] || 'text',
      code: m[2].trim()
    }));
  };

  const stripCodeBlocks = (text: string) =>
    text.replace(/```(\w+)?[\r\n]+([\s\S]*?)```/g, '').trim();

  const openCanvasForMessage = (codeBlocks: Array<{id: string, code: string, language: string}>) => {
    setCodeCanvases(prev => {
      const existingIds = prev.map(c => c.id);
      const hasAny = codeBlocks.some(b => existingIds.includes(b.id));
      if (hasAny) return prev.filter(c => !codeBlocks.map(b => b.id).includes(c.id));
      return [...prev, ...codeBlocks];
    });
  };

  const handleStreamChunk = (chunk: any) => {
    switch (chunk.type) {
      case 'agent_start':
        currentAgentsRef.current = [...new Set([...currentAgentsRef.current, chunk.data.agentType])];
        setAgentActivities(prev => [...prev, {
          taskId: chunk.data.taskId,
          agentType: chunk.data.agentType,
          status: 'running'
        }]);
        break;

      case 'agent_complete':
        setAgentActivities(prev => prev.map(a =>
          a.taskId === chunk.data.taskId ? { ...a, status: chunk.data.status } : a
        ));
        break;

      case 'token':
        currentResponseRef.current += chunk.data;
        setCurrentResponse(currentResponseRef.current);
        break;

      case 'done':
        const finalContent = currentResponseRef.current;
        if (finalContent) {
          const codeBlocks = extractCodeBlocks(finalContent);
          setMessages(prev => [...prev, {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: finalContent,
            timestamp: Date.now(),
            agentsUsed: [...currentAgentsRef.current],
            codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined
          }]);
          if (codeBlocks.length > 0) setCodeCanvases(prev => [...prev, ...codeBlocks]);
        }
        currentResponseRef.current = '';
        currentAgentsRef.current = [];
        setCurrentResponse('');
        setAgentActivities([]);
        setIsLoading(false);
        break;

      case 'error':
        currentResponseRef.current = '';
        currentAgentsRef.current = [];
        setCurrentResponse('');
        setAgentActivities([]);
        setIsLoading(false);
        break;
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isLoading) return;

    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now()
    }]);

    currentResponseRef.current = '';
    currentAgentsRef.current = [];
    setCurrentResponse('');
    setAgentActivities([]);
    setIsLoading(true);
    wsRef.current.send(JSON.stringify({ type: 'user_message', content: input }));
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const allAgents = ['research', 'analysis', 'code', 'synthesis'];

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">M</div>
        <nav className="sidebar-nav">
          <div className="nav-item active" title="AI Chat">AI</div>
          <div className="sidebar-sep"></div>
          <div className="nav-item" title="Database">DB</div>
          <div className="nav-item" title="Vectorize">VZ</div>
          <div className="nav-item" title="KV Cache">KV</div>
        </nav>
        <div className="sidebar-bottom">
          <div className={`sidebar-status-dot ${isConnected ? 'online' : ''}`}></div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="main">

        {/* HEADER */}
        <header className="header">
          <div className="header-left">
            <span className="header-title">Multi-Agent System</span>
            <div className="header-sep"></div>
            <span className="header-model">llama-3.3-70b</span>
          </div>
          <div className="header-right">
            <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <div className={`conn-dot ${isConnected ? 'online' : ''}`}></div>
            <span className="conn-text">{isConnected ? 'connected' : 'offline'}</span>
          </div>
        </header>

        <div className="chat-area">

          {/* MESSAGES */}
          <div className="messages" ref={messagesContainerRef} onScroll={handleScroll}>

            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <Bot size={24} />
                </div>
                <p className="empty-title">Multi-Agent AI System</p>
                <p className="empty-sub">Powered by parallel agent execution, web search, and semantic memory.</p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`msg ${message.role}`}>
                <div className="msg-avatar">
                  {message.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                </div>
                <div className="msg-body">
                  <div className="msg-meta">
                    <span>{formatTime(message.timestamp)}</span>
                    {message.agentsUsed && message.agentsUsed.length > 0 && (
                      <span className="agents-used">{message.agentsUsed.join(' · ')}</span>
                    )}
                  </div>
                  <div className="msg-bubble">
                    {message.role === 'assistant' ? (
                      <ReactMarkdown>{stripCodeBlocks(message.content)}</ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.codeBlocks && message.codeBlocks.length > 0 && (
                    <button className="view-code-btn" onClick={() => openCanvasForMessage(message.codeBlocks!)}>
                      <Code size={11} />
                      {message.codeBlocks.length === 1
                        ? `view ${message.codeBlocks[0].language} code`
                        : `view ${message.codeBlocks.length} code blocks`}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {currentResponse && (
              <div className="msg assistant">
                <div className="msg-avatar"><Bot size={12} /></div>
                <div className="msg-body">
                  <div className="msg-meta">
                    <span>{formatTime(Date.now())}</span>
                    {currentAgentsRef.current.length > 0 && (
                      <span className="agents-used">{currentAgentsRef.current.join(' · ')}</span>
                    )}
                  </div>
                  <div className="msg-bubble">
                    <ReactMarkdown>{stripCodeBlocks(currentResponse)}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {isLoading && !currentResponse && (
              <div className="msg assistant">
                <div className="msg-avatar"><Bot size={12} /></div>
                <div className="msg-body">
                  <div className="msg-bubble loading">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* AGENT PANEL */}
          <aside className="agent-panel">
            <div className="agent-panel-title">agents</div>
            {allAgents.map(agentName => {
              const activity = agentActivities.find(a => a.agentType === agentName);
              const status = activity?.status || 'idle';
              const progress = status === 'completed' ? 100 : status === 'running' ? 60 : 0;
              return (
                <div key={agentName} className="agent-item">
                  <div className="agent-header">
                    <span className="agent-name">{agentName}</span>
                    <span className={`agent-status ${status}`}>
                      {status === 'running' && <Loader2 size={9} className="spin" />}
                      {status === 'completed' && <CheckCircle size={9} />}
                      {status}
                    </span>
                  </div>
                  <div className="agent-track">
                    <div className={`agent-fill ${status}`} style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              );
            })}
          </aside>

        </div>

        {/* SCROLL BUTTON */}
        {showScrollButton && (
          <button className="scroll-btn" onClick={() => {
            isUserScrollingRef.current = false;
            setShowScrollButton(false);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}>
            <ChevronDown size={14} />
          </button>
        )}

        {/* INPUT */}
        <div className="input-area">
          <div className="input-wrap">
            <span className="input-prefix">›</span>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask anything..."
              disabled={!isConnected || isLoading}
              rows={1}
            />
          </div>
          <button className="send-btn" onClick={sendMessage} disabled={!input.trim() || !isConnected || isLoading}>
            {isLoading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
          </button>
        </div>

      </main>

      {/* CODE CANVASES */}
      {codeCanvases.map(canvas => (
        <CodeCanvas
          key={canvas.id}
          code={canvas.code}
          language={canvas.language}
          onClose={() => setCodeCanvases(prev => prev.filter(c => c.id !== canvas.id))}
        />
      ))}
    </div>
  );
}

export default App;