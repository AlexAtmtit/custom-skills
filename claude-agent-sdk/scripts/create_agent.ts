#!/usr/bin/env npx tsx
/**
 * Claude Agent SDK - Agent Template Generator
 *
 * Creates a new agent project with boilerplate code.
 * Usage: npx tsx create_agent.ts <agent-name> <type>
 *
 * Types: code-review, research, automation, chat, custom
 */

import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES: Record<string, { tools: string[]; systemPrompt: string; description: string }> = {
  'code-review': {
    tools: ['Read', 'Glob', 'Grep'],
    systemPrompt: `You are a code review expert. Analyze code for:
- Bugs and potential crashes
- Security vulnerabilities
- Performance issues
- Code quality improvements

Be specific about file names and line numbers.`,
    description: 'Analyze codebases for bugs, security issues, and improvements'
  },
  'research': {
    tools: ['WebSearch', 'WebFetch', 'Read', 'Write'],
    systemPrompt: `You are a research specialist. Your workflow:
1. Break topics into subtopics
2. Search web for each subtopic
3. Extract and verify key information
4. Synthesize findings into clear reports`,
    description: 'Conduct comprehensive research on any topic'
  },
  'automation': {
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    systemPrompt: `You are a file automation specialist. You can:
- Read and analyze files
- Transform and process data
- Generate new files
- Run scripts and commands

Always verify your work before completing.`,
    description: 'Automate file operations and transformations'
  },
  'chat': {
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Bash'],
    systemPrompt: `You are a helpful AI assistant with access to files and the web.
Help users with coding, research, file operations, and more.
Be concise but thorough.`,
    description: 'Interactive chat assistant with full capabilities'
  },
  'custom': {
    tools: ['Read', 'Glob', 'Grep'],
    systemPrompt: `You are a specialized AI agent.
Customize this prompt for your specific use case.`,
    description: 'Minimal template for custom agents'
  }
};

function generateAgentCode(name: string, type: string): string {
  const config = TEMPLATES[type] || TEMPLATES['custom'];

  return `/**
 * ${name} Agent
 * Type: ${type}
 * ${config.description}
 *
 * Usage: npx tsx ${name}.ts [arguments]
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const SYSTEM_PROMPT = \`${config.systemPrompt}\`;

interface AgentResult {
  success: boolean;
  output?: any;
  error?: string;
  cost: number;
}

async function runAgent(prompt: string): Promise<AgentResult> {
  console.log(\`\\n🚀 Starting ${name} agent...\\n\`);

  let result: AgentResult = { success: false, cost: 0 };

  try {
    for await (const message of query({
      prompt,
      options: {
        model: "opus",
        allowedTools: ${JSON.stringify(config.tools)},
        permissionMode: "bypassPermissions",
        maxTurns: 250,
        systemPrompt: SYSTEM_PROMPT
      }
    })) {
      // Handle assistant messages
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if ("text" in block) {
            console.log(block.text);
          } else if ("name" in block) {
            console.log(\`\\n📁 Using \${block.name}...\`);
          }
        }
      }

      // Handle final result
      if (message.type === "result") {
        if (message.subtype === "success") {
          result = {
            success: true,
            output: message.structured_output,
            cost: message.total_cost_usd
          };
          console.log(\`\\n✅ Complete! Cost: $\${message.total_cost_usd.toFixed(4)}\`);
        } else {
          result = {
            success: false,
            error: message.subtype,
            cost: message.total_cost_usd || 0
          };
          console.log(\`\\n❌ Failed: \${message.subtype}\`);
        }
      }
    }
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      cost: 0
    };
    console.error(\`\\n❌ Error: \${result.error}\`);
  }

  return result;
}

// Main entry point
async function main() {
  const prompt = process.argv[2];

  if (!prompt) {
    console.log(\`
${name} Agent - ${config.description}

Usage: npx tsx ${name}.ts "<your prompt>"

Example:
  npx tsx ${name}.ts "Analyze the code in ./src"
\`);
    process.exit(1);
  }

  const result = await runAgent(prompt);
  process.exit(result.success ? 0 : 1);
}

main().catch(console.error);
`;
}

function generatePackageJson(name: string): string {
  return JSON.stringify({
    name: name,
    version: "1.0.0",
    type: "module",
    scripts: {
      start: `npx tsx ${name}.ts`,
      build: "tsc"
    },
    dependencies: {
      "@anthropic-ai/claude-agent-sdk": "latest"
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      "typescript": "^5.0.0",
      "tsx": "^4.0.0"
    }
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: "./dist"
    },
    include: ["*.ts"]
  }, null, 2);
}

function generateClaudeMd(name: string, type: string): string {
  const config = TEMPLATES[type] || TEMPLATES['custom'];

  return `# ${name}

## Overview
${config.description}

## Available Tools
${config.tools.map(t => `- ${t}`).join('\n')}

## Usage
\`\`\`bash
npx tsx ${name}.ts "your prompt here"
\`\`\`

## Custom Instructions
Add project-specific context and instructions here.
`;
}

// Main
const agentName = process.argv[2];
const agentType = process.argv[3] || 'custom';

if (!agentName) {
  console.log(`
Claude Agent SDK - Agent Template Generator

Usage: npx tsx create_agent.ts <agent-name> <type>

Types:
  code-review  - Analyze codebases for bugs and improvements
  research     - Conduct comprehensive web research
  automation   - Automate file operations
  chat         - Interactive chat with full capabilities
  custom       - Minimal template for custom agents

Example:
  npx tsx create_agent.ts my-reviewer code-review
`);
  process.exit(1);
}

if (!TEMPLATES[agentType]) {
  console.log(`Unknown type: ${agentType}`);
  console.log(`Available types: ${Object.keys(TEMPLATES).join(', ')}`);
  process.exit(1);
}

// Create project
const projectDir = path.join(process.cwd(), agentName);
fs.mkdirSync(projectDir, { recursive: true });

fs.writeFileSync(path.join(projectDir, `${agentName}.ts`), generateAgentCode(agentName, agentType));
fs.writeFileSync(path.join(projectDir, 'package.json'), generatePackageJson(agentName));
fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), generateTsConfig());
fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), generateClaudeMd(agentName, agentType));

console.log(`
✅ Created ${agentName} agent (${agentType})

Next steps:
  cd ${agentName}
  npm install
  export ANTHROPIC_API_KEY=your-key
  npx tsx ${agentName}.ts "your prompt"
`);
