---
name: claude-agent-sdk
description: Reference for Claude Agent SDK (@anthropic-ai/claude-agent-sdk). MUST use when working with Claude Agent SDK, claude-agent-sdk package, or code that imports from @anthropic-ai/claude-agent-sdk. Covers the SDK's query API, tool configuration, hooks, subagents, MCP integration, and structured output. Do NOT use for generic agent development or other agent frameworks.
---

# Claude Agent SDK

Build autonomous AI agents that read files, run commands, edit code, search the web, and more. The SDK provides the same tools, agent loop, and context management that power Claude Code.

## Core Concept

The key design principle: **give Claude a computer**. By providing tools to run bash commands, edit files, create files, and search files, Claude can work like humans do on any digital task.

## Agent Loop Pattern

Effective agents follow this feedback loop: **gather context → take action → verify work → repeat**

```
┌─────────────────────────────────────────────────────┐
│                    AGENT LOOP                       │
├─────────────────────────────────────────────────────┤
│  1. GATHER CONTEXT                                  │
│     - Read files, search codebase                   │
│     - Use subagents for parallel information        │
│     - Query external APIs via MCP                   │
│                                                     │
│  2. TAKE ACTION                                     │
│     - Execute tools (Read, Write, Edit, Bash)       │
│     - Generate and run code                         │
│     - Call external services                        │
│                                                     │
│  3. VERIFY WORK                                     │
│     - Run linters, tests, type checkers             │
│     - Visual feedback (screenshots)                 │
│     - LLM-as-judge for fuzzy validation             │
│     - Apply deterministic rules                     │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
npm install -g @anthropic-ai/claude-code
npm install @anthropic-ai/claude-agent-sdk
export ANTHROPIC_API_KEY=your-api-key
```

### Minimal Agent (TypeScript)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  for await (const message of query({
    prompt: "What files are in this directory?",
    options: {
      model: "opus",
      allowedTools: ["Glob", "Read"],
      maxTurns: 250
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if ("text" in block) console.log(block.text);
      }
    }
  }
}
main();
```

### Minimal Agent (Python)

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="What files are in this directory?",
        options=ClaudeAgentOptions(allowed_tools=["Bash", "Glob"])
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

## Reference Documentation

For detailed implementation patterns, see:

- **[api_reference.md](references/api_reference.md)**: Complete API, options, hooks, subagents, V2 API
- **[PATTERNS.md](references/PATTERNS.md)**: Code review, research, automation, chat patterns
- **[TOOLS.md](references/TOOLS.md)**: Built-in tools and MCP integration
- **[PRODUCTION.md](references/PRODUCTION.md)**: Deployment, sandboxing, security, monitoring

## Scripts

- **[create_agent.ts](scripts/create_agent.ts)**: Generate new agent projects from templates

## Built-in Tools

| Tool | Purpose |
|------|---------|
| Read | Read any file in working directory |
| Write | Create new files |
| Edit | Make precise edits to existing files |
| Bash | Run terminal commands |
| Glob | Find files by pattern |
| Grep | Search file contents with regex |
| WebSearch | Search the web |
| WebFetch | Fetch and parse web pages |
| Task | Spawn subagents for parallel work |

## Agent Types by Use Case

**Code Review Agent**: `allowedTools: ["Read", "Glob", "Grep"]`
**File Automation Agent**: `allowedTools: ["Read", "Write", "Edit", "Bash", "Glob"]`
**Research Agent**: `allowedTools: ["WebSearch", "WebFetch", "Read", "Write"]`
**Multi-Agent Orchestrator**: `allowedTools: ["Read", "Glob", "Grep", "Task"]`

## Key Options

```typescript
options: {
  model: "opus" | "sonnet" | "haiku",  // Model selection
  maxTurns: 250,                        // Max agent iterations
  allowedTools: [...],                  // Tools available to agent
  permissionMode: "default" | "acceptEdits" | "bypassPermissions",
  systemPrompt: "...",                  // Custom system instructions
  settingSources: ["project"],          // Load skills from .claude/skills/
  outputFormat: { type: "json_schema", schema: {...} }  // Structured output
}
```

## Message Stream Types

```typescript
for await (const message of query({...})) {
  switch (message.type) {
    case "system":    // Session init, available tools
    case "assistant": // Claude's responses and tool calls
    case "result":    // Final result with cost info
  }
}
```

## When to Use Each Pattern

**Simple task, single file**: Direct query with basic tools
**Complex analysis**: Add structured output schema
**Large codebase**: Use subagents for parallel search
**External integrations**: Add MCP servers for custom tools
**Production deployment**: Add hooks for auditing and guardrails

## Verification Strategies

1. **Linting/Type checking**: Run after code generation
2. **Visual feedback**: Screenshot renders for UI work
3. **Deterministic rules**: Hooks that check specific conditions
4. **LLM-as-judge**: Subagent evaluates output quality

## Context Engineering

The file system represents information that _could_ be pulled into context:
- Use `CLAUDE.md` for project-level instructions
- Organize data folders for agentic search
- Let Claude use `grep`/`tail` on large files
- Use subagents to isolate context and return summaries
