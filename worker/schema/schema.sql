-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Agent executions table for analytics
CREATE TABLE IF NOT EXISTS agent_executions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    input TEXT NOT NULL,
    output TEXT,
    duration_ms INTEGER,
    tokens_used INTEGER,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_conversation ON agent_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_type ON agent_executions(agent_type);