# Agent Patterns and Architectures

Common patterns for building effective agents with Claude Agent SDK.

## Table of Contents

1. [Code Review Agent](#code-review-agent)
2. [Research Agent](#research-agent)
3. [File Automation Agent](#file-automation-agent)
4. [Chat Application](#chat-application)
5. [Multi-Agent Orchestration](#multi-agent-orchestration)
6. [Domain-Specific Agent](#domain-specific-agent)

---

## Code Review Agent

Analyze codebases for bugs, security issues, and quality improvements.

### Basic Implementation

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function reviewCode(directory: string) {
  console.log(`\n🔍 Starting code review for: ${directory}\n`);

  for await (const message of query({
    prompt: `Review the code in ${directory} for:
1. Bugs and potential crashes
2. Security vulnerabilities
3. Performance issues
4. Code quality improvements

Be specific about file names and line numbers.`,
    options: {
      model: "opus",
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      maxTurns: 250
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if ("text" in block) {
          console.log(block.text);
        } else if ("name" in block) {
          console.log(`\n📁 Using ${block.name}...`);
        }
      }
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        console.log(`\n✅ Review complete! Cost: $${message.total_cost_usd.toFixed(4)}`);
      }
    }
  }
}

reviewCode(".");
```

### With Structured Output

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
  prompt: `Review the code in ${directory}. Identify all issues.`,
  options: {
    model: "opus",
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    maxTurns: 250,
    outputFormat: {
      type: "json_schema",
      schema: reviewSchema
    }
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    const review = message.structured_output;
    console.log(`Score: ${review.overallScore}/100`);
    console.log(`Issues Found: ${review.issues.length}`);
  }
}
```

---

## Research Agent

Conduct comprehensive research using web search and file analysis.

### Multi-Agent Research System

```typescript
import { query, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

async function research(topic: string) {
  for await (const message of query({
    prompt: `Research "${topic}" comprehensively.
Break the topic into subtopics, research each in parallel, then synthesize findings.`,
    options: {
      model: "opus",
      allowedTools: ["WebSearch", "WebFetch", "Read", "Write", "Task"],
      permissionMode: "bypassPermissions",
      maxTurns: 250,
      agents: {
        "web-researcher": {
          description: "Searches web and extracts relevant information",
          prompt: `You are a research specialist. Search the web for information,
extract key facts, and summarize findings clearly.`,
          tools: ["WebSearch", "WebFetch"],
          model: "sonnet"
        } as AgentDefinition,

        "synthesizer": {
          description: "Combines research into coherent report",
          prompt: `You synthesize research findings into well-structured reports.
Focus on clarity, accuracy, and actionable insights.`,
          tools: ["Read", "Write"],
          model: "sonnet"
        } as AgentDefinition
      }
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if ("text" in block) console.log(block.text);
        if ("name" in block && block.name === "Task") {
          console.log(`\n🔍 Delegating to: ${(block.input as any).subagent_type}`);
        }
      }
    }
  }
}
```

---

## File Automation Agent

Automate file operations, transformations, and batch processing.

### Resume Generator Example

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const SYSTEM_PROMPT = `You are a professional resume writer.
Research a person and create a 1-page .docx resume.

WORKFLOW:
1. WebSearch for the person's background (LinkedIn, GitHub, company pages)
2. Create a .docx file using the docx library

OUTPUT:
- Script: agent/custom_scripts/generate_resume.js
- Resume: agent/custom_scripts/resume.docx`;

async function generateResume(personName: string) {
  console.log(`📝 Generating resume for: ${personName}\n`);

  const q = query({
    prompt: `Research "${personName}" and create a professional 1-page resume as a .docx file.`,
    options: {
      maxTurns: 30,
      cwd: process.cwd(),
      model: 'sonnet',
      allowedTools: ['Skill', 'WebSearch', 'WebFetch', 'Bash', 'Write', 'Read', 'Glob'],
      settingSources: ['project'],  // Load skills from .claude/skills/
      systemPrompt: SYSTEM_PROMPT,
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text') console.log(block.text);
        if (block.type === 'tool_use') {
          console.log(`🔧 Using tool: ${block.name}`);
        }
      }
    }
  }
}
```

---

## Chat Application

Build interactive chat applications with streaming responses.

### Message Queue Pattern

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

type UserMessage = {
  type: "user";
  message: { role: "user"; content: string };
};

class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = {
      type: "user",
      message: { role: "user", content },
    };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<UserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<UserMessage>((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }

  close() { this.closed = true; }
}

class AgentSession {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<any> | null = null;

  constructor() {
    this.outputIterator = query({
      prompt: this.queue as any,
      options: {
        maxTurns: 100,
        model: "opus",
        allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
        systemPrompt: "You are a helpful AI assistant.",
      },
    })[Symbol.asyncIterator]();
  }

  sendMessage(content: string) {
    this.queue.push(content);
  }

  async *getOutputStream() {
    if (!this.outputIterator) throw new Error("Session not initialized");
    while (true) {
      const { value, done } = await this.outputIterator.next();
      if (done) break;
      yield value;
    }
  }

  close() { this.queue.close(); }
}
```

---

## Multi-Agent Orchestration

Coordinate multiple specialized agents for complex tasks.

### Comprehensive Review with Subagents

```typescript
import { query, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

async function comprehensiveReview(directory: string) {
  for await (const message of query({
    prompt: `Perform a comprehensive code review of ${directory}.
Use the security-reviewer for security issues and test-analyzer for test coverage.`,
    options: {
      model: "opus",
      allowedTools: ["Read", "Glob", "Grep", "Task"],
      permissionMode: "bypassPermissions",
      maxTurns: 250,
      agents: {
        "security-reviewer": {
          description: "Security specialist for vulnerability detection",
          prompt: `You are a security expert. Focus on:
- SQL injection, XSS, CSRF vulnerabilities
- Exposed credentials and secrets
- Insecure data handling
- Authentication/authorization issues`,
          tools: ["Read", "Grep", "Glob"],
          model: "sonnet"
        } as AgentDefinition,

        "test-analyzer": {
          description: "Test coverage and quality analyzer",
          prompt: `You are a testing expert. Analyze:
- Test coverage gaps
- Missing edge cases
- Test quality and reliability
- Suggestions for additional tests`,
          tools: ["Read", "Grep", "Glob"],
          model: "haiku"
        } as AgentDefinition,

        "performance-reviewer": {
          description: "Performance optimization specialist",
          prompt: `You are a performance expert. Look for:
- N+1 queries
- Memory leaks
- Inefficient algorithms
- Caching opportunities`,
          tools: ["Read", "Grep", "Glob"],
          model: "sonnet"
        } as AgentDefinition
      }
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if ("text" in block) console.log(block.text);
        if ("name" in block && block.name === "Task") {
          console.log(`\n🤖 Delegating to: ${(block.input as any).subagent_type}`);
        }
      }
    }
  }
}
```

### Parallel Search Subagents

```typescript
// Main agent can spin up multiple read subagents for parallel search
// Useful for large spreadsheets, document collections, etc.

/*
Main agent approach:
"Can this agent read and summarize sheet one?
Can this agent read and summarize sheet two?
Can this agent read and summarize sheet three?"

Each subagent:
- Gets isolated context window
- Returns only relevant results
- Runs in parallel for efficiency
*/
```

---

## Domain-Specific Agent

Build agents with custom APIs and domain knowledge.

### Pokemon Team Builder (Example)

```typescript
// Create CLAUDE.md for domain context
const CLAUDE_MD = `
# Pokemon Team Builder

## TypeScript SDK
Import from ./poke-api-sdk for all Pokemon data.

## Key Files
- poke-api-sdk/pokemon.ts: Pokemon interface and API
- poke-api-sdk/moves.ts: Move data and calculations
- data/smogon/: Competitive analysis data

## Rules
- Write scripts to custom_scripts/ directory
- Use the TypeScript API for all Pokemon queries
- Reference Smogon data for competitive viability
`;

// Agent configuration
for await (const message of query({
  prompt: "Build me a competitive Pokemon team around Venusaur",
  options: {
    model: "opus",
    cwd: "./pokemon-agent",
    allowedTools: ["Read", "Write", "Bash", "Glob", "Grep"],
    settingSources: ["project"],
    maxTurns: 250
  }
})) {
  // Handle messages
}
```

### Context Engineering Tips

1. **Organize data folders** for agentic search
2. **Generate TypeScript APIs** from external services
3. **Store domain knowledge** in searchable text files
4. **Use CLAUDE.md** for project-specific instructions
5. **Let the agent write scripts** to interact with APIs

---

## Best Practices Summary

### Tool Selection by Use Case

| Use Case | Recommended Tools |
|----------|-------------------|
| Code analysis | Read, Glob, Grep |
| File modification | Read, Write, Edit, Bash |
| Web research | WebSearch, WebFetch |
| Complex tasks | Add Task for subagents |
| External APIs | Add custom MCP servers |

### Model Selection

| Task Complexity | Model | Notes |
|-----------------|-------|-------|
| Simple queries | haiku | Fast, cost-effective |
| Standard tasks | sonnet | Balanced performance |
| Complex reasoning | opus | Best quality |
| Mixed (subagents) | Vary by task | opus orchestrator, sonnet/haiku workers |

### Verification Strategies

1. **Always lint generated code** before execution
2. **Use TypeScript** for better feedback via type checking
3. **Add hooks** for deterministic validation
4. **Screenshot renders** for visual verification
5. **Test scripts** before committing changes
