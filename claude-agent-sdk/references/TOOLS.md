# Built-in Tools and MCP Integration

Complete guide to tools available in Claude Agent SDK.

## Table of Contents

1. [Built-in Tools](#built-in-tools)
2. [Tool Selection Guide](#tool-selection-guide)
3. [Custom Tools with MCP](#custom-tools-with-mcp)
4. [Permission Handling](#permission-handling)

---

## Built-in Tools

The SDK provides these tools out of the box:

### File System Tools

#### Read
Read any file in the working directory.

```typescript
// Automatically used by Claude when needed
// No configuration required
allowedTools: ["Read"]
```

#### Write
Create new files.

```typescript
allowedTools: ["Write"]
```

#### Edit
Make precise edits to existing files.

```typescript
allowedTools: ["Edit"]
```

#### MultiEdit
Make multiple edits to a file in one operation.

```typescript
allowedTools: ["MultiEdit"]
```

### Search Tools

#### Glob
Find files by pattern.

```typescript
allowedTools: ["Glob"]
// Claude uses patterns like "**/*.ts", "src/**/*.py"
```

#### Grep
Search file contents with regex.

```typescript
allowedTools: ["Grep"]
// Claude searches for patterns in files
```

### Execution Tools

#### Bash
Run terminal commands.

```typescript
allowedTools: ["Bash"]
// Claude can run npm, git, python, etc.
```

#### BashOutput
Get output from running bash commands.

```typescript
allowedTools: ["BashOutput"]
```

#### KillBash
Terminate running bash processes.

```typescript
allowedTools: ["KillBash"]
```

### Web Tools

#### WebSearch
Search the web.

```typescript
allowedTools: ["WebSearch"]
// Claude searches for information online
```

#### WebFetch
Fetch and parse web pages.

```typescript
allowedTools: ["WebFetch"]
// Claude retrieves and reads web content
```

### Agent Tools

#### Task
Spawn subagents for parallel or specialized work.

```typescript
allowedTools: ["Task"]
// Enables subagent creation
```

### Utility Tools

#### TodoWrite
Track progress on multi-step tasks.

```typescript
allowedTools: ["TodoWrite"]
```

#### NotebookEdit
Edit Jupyter notebooks.

```typescript
allowedTools: ["NotebookEdit"]
```

#### LS
List directory contents.

```typescript
allowedTools: ["LS"]
```

#### Skill
Load and use skills from .claude/skills/.

```typescript
allowedTools: ["Skill"]
settingSources: ["project"]  // Required to load skills
```

#### ExitPlanMode
Exit planning mode and proceed to execution.

```typescript
allowedTools: ["ExitPlanMode"]
```

---

## Tool Selection Guide

### By Use Case

| Use Case | Recommended Tools |
|----------|-------------------|
| Code review (read-only) | Read, Glob, Grep |
| Code modification | Read, Write, Edit, Bash, Glob |
| Research | WebSearch, WebFetch, Read, Write |
| File processing | Read, Write, Bash, Glob |
| Multi-agent work | Task, Read, Glob, Grep |
| Full automation | All tools |

### Common Combinations

**Code Review Agent:**
```typescript
allowedTools: ["Read", "Glob", "Grep"]
```

**Development Agent:**
```typescript
allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
```

**Research Agent:**
```typescript
allowedTools: ["WebSearch", "WebFetch", "Read", "Write"]
```

**Orchestrator Agent:**
```typescript
allowedTools: ["Read", "Glob", "Grep", "Task"]
```

**Full-Featured Agent:**
```typescript
allowedTools: [
  "Task", "Bash", "Glob", "Grep", "LS", "ExitPlanMode",
  "Read", "Edit", "MultiEdit", "Write", "NotebookEdit",
  "WebFetch", "TodoWrite", "WebSearch", "BashOutput", "KillBash"
]
```

---

## Custom Tools with MCP

Extend Claude with custom tools using Model Context Protocol.

### Creating an MCP Server

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Create a custom tool server
const customServer = createSdkMcpServer({
  name: "code-metrics",
  version: "1.0.0",
  tools: [
    tool(
      "analyze_complexity",
      "Calculate cyclomatic complexity for a file",
      {
        filePath: z.string().describe("Path to the file to analyze")
      },
      async (args) => {
        // Your analysis logic here
        const complexity = calculateComplexity(args.filePath);
        return {
          content: [{
            type: "text",
            text: `Cyclomatic complexity for ${args.filePath}: ${complexity}`
          }]
        };
      }
    ),

    tool(
      "count_lines",
      "Count lines of code in a file",
      {
        filePath: z.string().describe("Path to the file"),
        excludeComments: z.boolean().optional().describe("Exclude comment lines")
      },
      async (args) => {
        const lines = countLines(args.filePath, args.excludeComments);
        return {
          content: [{
            type: "text",
            text: `Lines of code: ${lines}`
          }]
        };
      }
    )
  ]
});
```

### Using MCP Server in Query

```typescript
// Use streaming input for MCP servers
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "Analyze the complexity of main.ts"
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),
  options: {
    model: "opus",
    mcpServers: { "code-metrics": customServer },
    allowedTools: ["Read", "mcp__code-metrics__analyze_complexity", "mcp__code-metrics__count_lines"],
    maxTurns: 250
  }
})) {
  // Handle messages
}
```

### MCP Tool Naming Convention

MCP tools are named with the pattern: `mcp__<server-name>__<tool-name>`

Example:
```typescript
allowedTools: [
  "Read",  // Built-in tool
  "mcp__code-metrics__analyze_complexity",  // MCP tool
  "mcp__my-api__fetch_data"  // Another MCP tool
]
```

### Common MCP Integrations

Popular MCP servers for common services:

- **Slack**: Message search, channel management
- **GitHub**: Issues, PRs, code search
- **Google Drive**: Document access
- **Asana**: Task management
- **Playwright**: Browser automation, screenshots

---

## Permission Handling

Control how Claude requests permission to use tools.

### Permission Modes

```typescript
options: {
  // Standard mode - prompts for approval
  permissionMode: "default",

  // Auto-approve file edits
  permissionMode: "acceptEdits",

  // No prompts (use with caution)
  permissionMode: "bypassPermissions"
}
```

### Custom Permission Handler

For fine-grained control, use `canUseTool`:

```typescript
options: {
  canUseTool: async (toolName, input) => {
    // Allow all read operations
    if (["Read", "Glob", "Grep"].includes(toolName)) {
      return { behavior: "allow", updatedInput: input };
    }

    // Block writes to certain files
    if (toolName === "Write" && input.file_path?.includes(".env")) {
      return { behavior: "deny", message: "Cannot modify .env files" };
    }

    // Block dangerous bash commands
    if (toolName === "Bash") {
      const command = input.command || "";
      if (command.includes("rm -rf") || command.includes("sudo")) {
        return { behavior: "deny", message: "Dangerous command blocked" };
      }
    }

    // Allow everything else
    return { behavior: "allow", updatedInput: input };
  }
}
```

### Using Hooks for Permission Control

```typescript
import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const blockDangerousCommands: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;

    if (preInput.tool_name === "Bash") {
      const command = (preInput.tool_input as any).command || "";

      // Block dangerous patterns
      const dangerousPatterns = ["rm -rf", "sudo", "chmod 777", "mkfs", "dd if="];
      for (const pattern of dangerousPatterns) {
        if (command.includes(pattern)) {
          return {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: `Blocked dangerous command: ${pattern}`
            }
          };
        }
      }
    }

    // Block writing scripts outside allowed directory
    if (["Write", "Edit", "MultiEdit"].includes(preInput.tool_name)) {
      const filePath = (preInput.tool_input as any).file_path || "";
      const ext = path.extname(filePath).toLowerCase();

      if ((ext === '.js' || ext === '.ts') && !filePath.includes('custom_scripts')) {
        return {
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "Script files must be in custom_scripts directory"
          }
        };
      }
    }
  }
  return {};
};

// Use in query
options: {
  hooks: {
    PreToolUse: [
      { matcher: "Bash|Write|Edit|MultiEdit", hooks: [blockDangerousCommands] }
    ]
  }
}
```

### Audit Logging

Log all tool usage for monitoring:

```typescript
const auditLogger: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === "PreToolUse") {
    const preInput = input as PreToolUseHookInput;
    console.log(`[AUDIT] ${new Date().toISOString()} - Tool: ${preInput.tool_name}`);
    console.log(`[AUDIT] Input: ${JSON.stringify(preInput.tool_input)}`);
  }
  return {}; // Allow the operation
};

options: {
  hooks: {
    PreToolUse: [{ hooks: [auditLogger] }]
  }
}
```
