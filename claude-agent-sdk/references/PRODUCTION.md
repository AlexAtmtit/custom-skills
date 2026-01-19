# Production Deployment Guide

Deploy Claude Agent SDK agents to production environments.

## Table of Contents

1. [Deployment Options](#deployment-options)
2. [Sandbox Hosting](#sandbox-hosting)
3. [Local Desktop Apps](#local-desktop-apps)
4. [Security Best Practices](#security-best-practices)
5. [Cost Management](#cost-management)
6. [Monitoring and Logging](#monitoring-and-logging)

---

## Deployment Options

### Two Main Approaches

1. **Local Desktop Apps**: Run agents locally on user machines
2. **Hosted Sandboxes**: Run agents in cloud sandboxes

### When to Use Each

| Approach | Best For | Considerations |
|----------|----------|----------------|
| Local Apps | Developer tools, personal assistants | Simpler deployment, user owns compute |
| Hosted Sandboxes | Multi-user services, production APIs | Scalable, isolated, requires infrastructure |

---

## Sandbox Hosting

Run agents in isolated cloud sandboxes for production use.

### Cloudflare Workers Example

```typescript
// Worker that runs agent in sandbox
import { sandbox } from "sandbox-provider";

export default {
  async fetch(request: Request): Promise<Response> {
    const { prompt } = await request.json();

    // Start sandbox and run agent
    const result = await sandbox.start(async (sb) => {
      return await sb.run("bun", ["agent.ts", prompt]);
    });

    return new Response(JSON.stringify(result));
  }
};
```

### Sandbox Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Your Application                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐         │
│  │ User 1  │    │ User 2  │    │ User 3  │         │
│  │ Sandbox │    │ Sandbox │    │ Sandbox │         │
│  └────┬────┘    └────┬────┘    └────┬────┘         │
│       │              │              │              │
│       └──────────────┼──────────────┘              │
│                      │                             │
│              ┌───────▼───────┐                     │
│              │  Agent SDK    │                     │
│              │   Runtime     │                     │
│              └───────┬───────┘                     │
│                      │                             │
│              ┌───────▼───────┐                     │
│              │  Anthropic    │                     │
│              │     API       │                     │
│              └───────────────┘                     │
└─────────────────────────────────────────────────────┘
```

### Customizable UI with Dev Server

For agents with dynamic user interfaces:

```typescript
// In sandbox, run a dev server that the agent can modify
const devServer = await startDevServer({
  port: 3000,
  liveReload: true
});

// Agent can edit code, and UI updates live
for await (const message of query({
  prompt: "Build a dashboard for this data",
  options: {
    model: "opus",
    allowedTools: ["Read", "Write", "Edit", "Bash"],
    cwd: "./frontend"
  }
})) {
  // User sees live updates in their browser
}
```

---

## Local Desktop Apps

Build agents that run locally on user machines.

### Electron/Tauri App Pattern

```typescript
// Main process
import { query } from "@anthropic-ai/claude-agent-sdk";

ipcMain.handle("run-agent", async (event, prompt) => {
  const results = [];

  for await (const message of query({
    prompt,
    options: {
      model: "sonnet",
      allowedTools: ["Read", "Write", "Glob", "Grep"],
      cwd: userSelectedDirectory
    }
  })) {
    // Stream results to renderer
    event.sender.send("agent-message", message);
    results.push(message);
  }

  return results;
});
```

### Benefits of Local Apps

- No server infrastructure needed
- User controls their own compute costs
- Direct file system access
- Works offline (after initial auth)
- Privacy-preserving

---

## Security Best Practices

### API Key Management

```typescript
// Never hardcode API keys
const apiKey = process.env.ANTHROPIC_API_KEY;

// For user-facing apps, use secure storage
import keytar from "keytar";
const apiKey = await keytar.getPassword("my-app", "anthropic-api-key");
```

### Sandboxing Agent Execution

```typescript
// Restrict file system access
options: {
  cwd: "/safe/directory",  // Limit working directory
  allowedTools: ["Read", "Glob"],  // Limit to read-only
}

// Use hooks to enforce boundaries
const enforceBoundaries: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;

    if (preInput.tool_name === "Read" || preInput.tool_name === "Write") {
      const filePath = (preInput.tool_input as any).file_path || "";
      if (!filePath.startsWith("/safe/directory")) {
        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "Access outside safe directory denied"
          }
        };
      }
    }
  }
  return {};
};
```

### Credential Protection

```typescript
// Block access to sensitive files
const blockSensitiveFiles: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;

    if (["Read", "Write", "Edit"].includes(preInput.tool_name)) {
      const filePath = (preInput.tool_input as any).file_path || "";
      const sensitivePatterns = [".env", "credentials", "secrets", ".pem", ".key"];

      for (const pattern of sensitivePatterns) {
        if (filePath.toLowerCase().includes(pattern)) {
          return {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: "Access to sensitive files blocked"
            }
          };
        }
      }
    }
  }
  return {};
};
```

### Command Injection Prevention

```typescript
// Block dangerous bash commands
const blockDangerousCommands: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;

    if (preInput.tool_name === "Bash") {
      const command = (preInput.tool_input as any).command || "";

      const blockedPatterns = [
        "rm -rf",
        "sudo",
        "chmod 777",
        "curl | sh",
        "wget | sh",
        "eval",
        "> /dev/",
        "mkfs",
        "dd if="
      ];

      for (const pattern of blockedPatterns) {
        if (command.includes(pattern)) {
          return {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: `Dangerous command pattern blocked: ${pattern}`
            }
          };
        }
      }
    }
  }
  return {};
};
```

---

## Cost Management

### Track Costs Per Request

```typescript
interface UsageRecord {
  timestamp: Date;
  userId: string;
  prompt: string;
  cost: number;
  tokens: TokenUsage;
}

const usageLog: UsageRecord[] = [];

for await (const message of query({ prompt, options })) {
  if (message.type === "result" && message.subtype === "success") {
    usageLog.push({
      timestamp: new Date(),
      userId,
      prompt,
      cost: message.total_cost_usd,
      tokens: message.usage
    });

    console.log(`Cost: $${message.total_cost_usd.toFixed(4)}`);

    // Per-model breakdown
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      console.log(`  ${model}: $${usage.costUSD.toFixed(4)}`);
    }
  }
}
```

### Set Cost Limits

```typescript
const MAX_COST_PER_REQUEST = 1.0;  // $1 limit
const MAX_TURNS = 50;  // Limit iterations

for await (const message of query({
  prompt,
  options: {
    maxTurns: MAX_TURNS,
    // Add custom cost tracking
  }
})) {
  if (message.type === "result") {
    if (message.total_cost_usd > MAX_COST_PER_REQUEST) {
      console.warn(`Request exceeded cost limit: $${message.total_cost_usd}`);
    }
  }
}
```

### Optimize Model Selection

```typescript
// Use cheaper models for simple tasks
agents: {
  "simple-search": {
    model: "haiku",  // Fastest, cheapest
    tools: ["Grep", "Glob"]
  },
  "analysis": {
    model: "sonnet",  // Balanced
    tools: ["Read", "Grep"]
  },
  "complex-reasoning": {
    model: "opus",  // Most capable, most expensive
    tools: ["Read", "Write", "Edit"]
  }
}
```

---

## Monitoring and Logging

### Structured Logging

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

interface AgentLog {
  requestId: string;
  timestamp: string;
  type: string;
  details: any;
}

function log(entry: AgentLog) {
  console.log(JSON.stringify(entry));
}

const requestId = crypto.randomUUID();

for await (const message of query({ prompt, options })) {
  log({
    requestId,
    timestamp: new Date().toISOString(),
    type: message.type,
    details: message
  });
}
```

### Audit Trail with Hooks

```typescript
const auditHook: HookCallback = async (input, toolUseId, { signal }) => {
  const timestamp = new Date().toISOString();

  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;
    await writeToAuditLog({
      timestamp,
      event: "tool_start",
      tool: preInput.tool_name,
      input: preInput.tool_input
    });
  }

  if (input.hook_event_name === "PostToolUse") {
    await writeToAuditLog({
      timestamp,
      event: "tool_complete",
      toolUseId,
      success: true
    });
  }

  return {};
};
```

### Health Checks

```typescript
// Simple health check endpoint
async function healthCheck(): Promise<boolean> {
  try {
    for await (const message of query({
      prompt: "Reply with 'ok'",
      options: {
        model: "haiku",
        maxTurns: 1,
        allowedTools: []
      }
    })) {
      if (message.type === "result" && message.subtype === "success") {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Health check failed:", error);
    return false;
  }
}
```

### Metrics Collection

```typescript
interface Metrics {
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  toolUsage: Record<string, number>;
}

const metrics: Metrics = {
  totalRequests: 0,
  totalCost: 0,
  averageLatency: 0,
  errorRate: 0,
  toolUsage: {}
};

// Update metrics after each request
function updateMetrics(result: ResultMessage, latencyMs: number) {
  metrics.totalRequests++;
  metrics.totalCost += result.total_cost_usd;
  metrics.averageLatency = (metrics.averageLatency + latencyMs) / 2;

  if (result.subtype !== "success") {
    metrics.errorRate = (metrics.errorRate * (metrics.totalRequests - 1) + 1) / metrics.totalRequests;
  }
}
```
