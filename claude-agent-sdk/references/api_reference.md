# Claude Agent SDK API Reference

Complete API documentation for TypeScript and Python.

## Table of Contents

1. [Core Functions](#core-functions)
2. [Options Reference](#options-reference)
3. [Message Types](#message-types)
4. [Hooks System](#hooks-system)
5. [Subagents](#subagents)
6. [Structured Output](#structured-output)
7. [Session Management](#session-management)
8. [V2 API (Preview)](#v2-api-preview)

---

## Core Functions

### query() - TypeScript

The main function for running agent queries:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const stream = query({
  prompt: string | AsyncIterable<UserMessage>,
  options: QueryOptions
});

for await (const message of stream) {
  // Handle messages
}
```

### query() - Python

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Your prompt here",
    options=ClaudeAgentOptions(...)
):
    # Handle messages
```

---

## Options Reference

### QueryOptions (TypeScript)

```typescript
interface QueryOptions {
  // Model selection
  model: "opus" | "sonnet" | "haiku";

  // Execution limits
  maxTurns: number;              // Max agent iterations (default: 250)

  // Tool configuration
  allowedTools: string[];        // Tools available to agent

  // Permission handling
  permissionMode:
    | "default"          // Prompts for approval
    | "acceptEdits"      // Auto-approve file edits
    | "bypassPermissions"; // No prompts (use with caution)

  // Custom permission handler
  canUseTool?: (toolName: string, input: any) => Promise<{
    behavior: "allow" | "deny";
    updatedInput?: any;
    message?: string;
  }>;

  // Working directory
  cwd?: string;

  // Custom system prompt
  systemPrompt?: string;

  // Load project settings
  settingSources?: ["project"];  // Load skills from .claude/skills/

  // Structured output
  outputFormat?: {
    type: "json_schema";
    schema: JSONSchema;
  };

  // Subagent definitions
  agents?: Record<string, AgentDefinition>;

  // MCP servers
  mcpServers?: Record<string, MCPServer>;

  // Hook callbacks
  hooks?: HooksConfig;

  // Session resume
  resume?: string;  // Session ID to resume

  // Executable path
  executable?: string;  // Node binary path
}
```

### ClaudeAgentOptions (Python)

```python
class ClaudeAgentOptions:
    model: str = "sonnet"
    max_turns: int = 250
    allowed_tools: list[str] = []
    permission_mode: str = "default"
    cwd: str = None
    system_prompt: str = None
    setting_sources: list[str] = None
    output_format: dict = None
    agents: dict = None
    mcp_servers: dict = None
    hooks: dict = None
    resume: str = None
```

---

## Message Types

### System Message

```typescript
interface SystemMessage {
  type: "system";
  subtype: "init" | "compact" | "error";
  session_id?: string;
  tools?: string[];
}
```

### Assistant Message

```typescript
interface AssistantMessage {
  type: "assistant";
  message: {
    role: "assistant";
    content: ContentBlock[];
  };
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any };
```

### Result Message

```typescript
interface ResultMessage {
  type: "result";
  subtype: "success" | "error" | "max_turns" | "cancelled";
  total_cost_usd: number;
  usage: TokenUsage;
  modelUsage: Record<string, ModelUsage>;
  structured_output?: any;  // When using outputFormat
}
```

---

## Hooks System

Hooks let you intercept and customize agent behavior.

### Hook Types

- **PreToolUse**: Before a tool is executed
- **PostToolUse**: After a tool completes

### Hook Configuration

```typescript
import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const auditLogger: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;
    console.log(`[AUDIT] ${new Date().toISOString()} - ${preInput.tool_name}`);
  }
  return {}; // Allow the operation
};

const blockDangerousCommands: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;
    if (preInput.tool_name === "Bash") {
      const command = (preInput.tool_input as any).command || "";
      if (command.includes("rm -rf") || command.includes("sudo")) {
        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "Dangerous command blocked"
          }
        };
      }
    }
  }
  return {};
};

// Use in query options
options: {
  hooks: {
    PreToolUse: [
      { hooks: [auditLogger] },
      { matcher: "Bash", hooks: [blockDangerousCommands] }
    ]
  }
}
```

### Hook Use Cases

1. **Audit logging**: Log all tool usage
2. **Security guardrails**: Block dangerous commands
3. **Input validation**: Modify or reject tool inputs
4. **Live context injection**: Insert user changes mid-session
5. **Rate limiting**: Control tool execution frequency

---

## Subagents

Spawn specialized agents for parallel or isolated work.

### Defining Subagents

```typescript
import { query, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Analyze this codebase comprehensively",
  options: {
    model: "opus",
    allowedTools: ["Read", "Glob", "Grep", "Task"],  // Task enables subagents
    agents: {
      "security-reviewer": {
        description: "Security specialist for vulnerability detection",
        prompt: `You are a security expert. Focus on:
- SQL injection, XSS, CSRF vulnerabilities
- Exposed credentials and secrets
- Insecure data handling`,
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      } as AgentDefinition,

      "test-analyzer": {
        description: "Test coverage and quality analyzer",
        prompt: `Analyze test coverage gaps and quality`,
        tools: ["Read", "Grep", "Glob"],
        model: "haiku"  // Use faster model for simpler analysis
      } as AgentDefinition
    }
  }
})) {
  // Handle messages
}
```

### Why Use Subagents

1. **Parallelization**: Run multiple searches/analyses simultaneously
2. **Context isolation**: Each subagent has its own context window
3. **Specialization**: Different prompts and tools per task
4. **Model selection**: Use cheaper/faster models for simpler subtasks

---

## Structured Output

Get typed JSON responses using JSON Schema:

```typescript
const reviewSchema = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          category: { type: "string", enum: ["bug", "security", "performance", "style"] },
          file: { type: "string" },
          line: { type: "number" },
          description: { type: "string" },
          suggestion: { type: "string" }
        },
        required: ["severity", "category", "file", "description"]
      }
    },
    summary: { type: "string" },
    overallScore: { type: "number" }
  },
  required: ["issues", "summary", "overallScore"]
};

for await (const message of query({
  prompt: "Review this codebase",
  options: {
    outputFormat: {
      type: "json_schema",
      schema: reviewSchema
    }
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    const review = message.structured_output as ReviewResult;
    console.log(`Score: ${review.overallScore}/100`);
  }
}
```

---

## Session Management

Capture and resume sessions for multi-turn conversations:

```typescript
let sessionId: string | undefined;

// Initial query
for await (const message of query({
  prompt: "Review this codebase and identify the top 3 issues",
  options: { ... }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Follow-up using same session
if (sessionId) {
  for await (const message of query({
    prompt: "Now show me how to fix the most critical issue",
    options: {
      resume: sessionId,  // Continue the conversation
      ...
    }
  })) {
    // Claude remembers the previous context
  }
}
```

---

## V2 API (Preview)

The V2 API provides a session-based interface with separate send()/receive():

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,
} from '@anthropic-ai/claude-agent-sdk';

// Basic session
async function basicSession() {
  await using session = unstable_v2_createSession({ model: 'sonnet' });
  await session.send('Hello! Introduce yourself.');

  for await (const msg of session.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content.find(c => c.type === 'text');
      console.log(`Claude: ${text?.text}`);
    }
  }
}

// Multi-turn conversation
async function multiTurn() {
  await using session = unstable_v2_createSession({ model: 'sonnet' });

  // Turn 1
  await session.send('What is 5 + 3?');
  for await (const msg of session.stream()) { /* handle */ }

  // Turn 2 - Claude remembers context
  await session.send('Multiply that by 2.');
  for await (const msg of session.stream()) { /* handle */ }
}

// One-shot convenience function
async function oneShot() {
  const result = await unstable_v2_prompt('What is the capital of France?', { model: 'sonnet' });

  if (result.subtype === 'success') {
    console.log(`Answer: ${result.result}`);
    console.log(`Cost: $${result.total_cost_usd.toFixed(4)}`);
  }
}

// Session resume
async function sessionResume() {
  let sessionId: string;

  {
    await using session = unstable_v2_createSession({ model: 'sonnet' });
    await session.send('My favorite color is blue. Remember this!');

    for await (const msg of session.stream()) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
      }
    }
  }

  // Resume in new session
  {
    await using session = unstable_v2_resumeSession(sessionId, { model: 'sonnet' });
    await session.send('What is my favorite color?');
    // Claude remembers: "blue"
  }
}
```

---

## Cost Tracking

```typescript
for await (const message of query({ prompt: "..." })) {
  if (message.type === "result" && message.subtype === "success") {
    console.log("Total cost:", message.total_cost_usd);
    console.log("Token usage:", message.usage);

    // Per-model breakdown (useful with subagents)
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      console.log(`${model}: $${usage.costUSD.toFixed(4)}`);
    }
  }
}
```
