# cf_ai_multi_agent_system

A production-grade multi-agent AI system built on Cloudflare's edge infrastructure. Combines multiple specialist AI agents running in parallel to deliver comprehensive, accurate responses with real-time streaming.

## Architecture
```
User Input (Pages)
      ↓
Cloudflare Worker (Router)
      ↓
Coordinator Durable Object (Orchestrator)
      ↓ (parallel execution)
┌─────────────┬──────────────┬─────────────┐
│ Research    │ Analysis     │ Code        │
│ Agent       │ Agent        │ Agent       │
│ (Web Search)│ (Insights)   │ (Generation)│
└─────────────┴──────────────┴─────────────┘
      ↓
Synthesis Agent (Final Response)
      ↓
Stream back to user via WebSocket
```

## Cloudflare Products Used

- **Workers AI** — Llama 3.3 70B for all agent LLM calls
- **Durable Objects** — Stateful coordinator managing agent lifecycle and WebSocket sessions
- **D1** — Persistent conversation and message history
- **KV** — Fast cache for user preferences and session data
- **Vectorize** — Semantic embeddings for conversation memory and context retrieval
- **Pages** — React frontend with real-time WebSocket chat

## Features

- Multi-agent task decomposition (research, analysis, code, synthesis)
- Parallel agent execution using Promise.all
- Real-time token streaming via WebSocket
- Web search integration via DuckDuckGo API
- Semantic memory using Vectorize embeddings
- Code canvas with syntax highlighting
- Dark/light mode
- Markdown rendering
- Conversation persistence

## Local Development

### Prerequisites

- Node.js v18+
- npm
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account

### Setup

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/cf_ai_multi_agent_system
cd cf_ai_multi_agent_system
```

2. Install worker dependencies:
```bash
cd worker
npm install
```

3. Authenticate with Cloudflare:
```bash
wrangler login
```

4. Create required Cloudflare resources:
```bash
wrangler d1 create multi-agent-db
wrangler kv:namespace create CACHE
wrangler vectorize create conversation-index --dimensions=768 --metric=cosine
```

5. Update `wrangler.toml` with your resource IDs from the output above.

6. Apply database schema:
```bash
wrangler d1 execute multi-agent-db --remote --file=schema/schema.sql
```

7. Start the worker:
```bash
npm run dev
```

8. In a new terminal, install and start the frontend:
```bash
cd ../frontend
npm install
npm run dev
```

9. Open http://localhost:5173

### Testing the Agents

Try these prompts to test different agents:

- **Code Agent**: `Write a Python function to calculate fibonacci numbers`
- **Research Agent**: `What are the latest trends in artificial intelligence?`
- **Analysis Agent**: `Analyze the pros and cons of microservices architecture`
- **Multi-Agent**: `Explain blockchain and write a Python implementation`
- **All Agents**: `Research machine learning, analyze its business impact, and write a Python example`

## Deployed Application

- **Frontend**: https://multi-agent-frontend.pages.dev
- **API**: https://multi-agent-system.YOUR_SUBDOMAIN.workers.dev

## Project Structure
```
cf_ai_multi_agent_system/
├── worker/
│   ├── src/
│   │   ├── index.ts              # Worker entry point and router
│   │   ├── coordinator.ts        # Coordinator Durable Object
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── agents/
│   │   │   ├── research-agent.ts # Web search + LLM research
│   │   │   ├── analysis-agent.ts # Data analysis and insights
│   │   │   ├── code-agent.ts     # Code generation
│   │   │   └── synthesis-agent.ts# Result synthesis
│   │   ├── llm/
│   │   │   ├── client.ts         # Workers AI LLM abstraction
│   │   │   └── prompt-templates.ts
│   │   ├── memory/
│   │   │   ├── d1-store.ts       # D1 conversation persistence
│   │   │   ├── kv-cache.ts       # KV fast cache
│   │   │   └── vectorize-store.ts# Semantic memory
│   │   ├── tools/
│   │   │   └── web-search.ts     # DuckDuckGo search integration
│   │   └── utils/
│   │       └── helpers.ts        # Utility functions
│   ├── schema/
│   │   └── schema.sql            # D1 database schema
│   └── wrangler.toml             # Cloudflare configuration
└── frontend/
    ├── src/
    │   ├── App.tsx               # Main React application
    │   ├── App.css               # Application styles
    │   └── components/
    │       ├── CodeCanvas.tsx    # Syntax highlighted code panel
    │       └── CodeCanvas.css
    └── package.json
```

## Technical Highlights

- **Parallel Execution**: All specialist agents run simultaneously using Promise.all, reducing response time significantly
- **Semantic Memory**: Every message is embedded using `@cf/baai/bge-base-en-v1.5` and stored in Vectorize for context retrieval
- **Real-time Streaming**: WebSocket connection to Durable Object enables token-by-token response streaming
- **Task Decomposition**: Intelligent routing detects query intent and activates appropriate specialist agents
- **Edge-Native**: Entire stack runs on Cloudflare's global edge network with zero cold starts

## Deployed Application
- **Frontend**: https://multi-agent-frontend.pages.dev
- **API**: https://multi-agent-system.penesi.workers.dev