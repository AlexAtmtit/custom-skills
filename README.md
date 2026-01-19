# Custom Skills for Claude Code, Droid, and Codex

My collection of custom skills for Claude Code, Droid, and Codex.

## Skills

| Skill | Description |
|-------|-------------|
| [🔍 codex-review](#-codex-review) | Automated code review using Codex CLI with Ralph Wiggum loop for continuous improvement |
| [🤖 claude-agent-sdk](#-claude-agent-sdk) | Comprehensive reference for building autonomous AI agents with Claude Agent SDK |

---

## 🔍 codex-review

**[codex-review](./codex-review/)** — Automated code review using OpenAI's Codex CLI, running in a continuous improvement loop.

### The Magic Combo ✨

I discovered a nearly perfect workflow that gives me 99% ready results:

- **Main work** happens in Claude Code with Opus 4.5
- **Deep reviews** come from Codex CLI's `/review` command — it does incredibly thorough code analysis, way deeper than review features in other agents

I used to run Codex reviews manually, but now this skill lets Claude Code launch the review automatically. Combined with the **Ralph Wiggum technique** (loop until done), Claude Code will:

1. Run Codex review
2. Fix all found issues
3. Run review again
4. Repeat until Codex says everything is good

Now when I finish adding new code, I just kick off this loop and wait for it to polish everything automatically 🙂

### How It Works

#### Prerequisites

1. **Ralph Wiggum plugin** — for running skills in a loop
2. **tmux** — Claude Code needs it to control CLI tools (otherwise it can't run the `/review` command)
3. **Codex CLI** — OpenAI's coding assistant

#### Running the Loop

Start Claude Code in permissionless mode:

```bash
claude --permission-mode=dontAsk --allowedTools "Bash" "Edit" "Read" "Write"
```

Then run the magic command:

```bash
/ralph-loop:ralph-loop "Use the codex-review skill to review uncommitted changes. Run the skill to execute Codex CLI /review (option 2: Review uncommitted changes) Wait for Codex to complete (up to 60 minutes) Parse output for P0, P1, P2 issues If Codex asks questions, answer them yourself choosing the most logical, secure, and robust option for this project Fix ALL found issues (P0 first, then P1, then P2) Run the review again Output <promise>REVIEW_COMPLETE</promise> ONLY when Codex confirms no issues found (e.g., 'I did not identify any discrete bugs or regressions' or similar positive confirmation)." --completion-promise "REVIEW_COMPLETE" --max-iterations 50
```

That's it! Claude Code launches Codex, runs the review, makes fixes, runs it again — and keeps going until Codex confirms there are no more issues 🎉

---

## 🤖 claude-agent-sdk

**[claude-agent-sdk](./claude-agent-sdk/)** — Comprehensive reference for building autonomous AI agents with `@anthropic-ai/claude-agent-sdk`. Covers the SDK's query API, tool configuration, hooks, subagents, MCP integration, and structured output.

### What It Does

The Claude Agent SDK is the infrastructure behind Claude Code, exposed as a library. It gives your agents the same capabilities: read files, run commands, edit code, search the web, and more. The key principle: **give Claude a computer** so it can work like humans do on any digital task.

### Agent Loop Pattern

Effective agents follow this feedback loop:

```
gather context → take action → verify work → repeat
```

### Built-in Tools

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

### Use Cases

- **Code Review Agents**: Analyze codebases for bugs, security issues, performance problems
- **Research Agents**: Search and synthesize information from multiple sources
- **File Automation**: Create, edit, and organize files programmatically
- **Multi-Agent Orchestration**: Coordinate specialized subagents for complex tasks

### Reference Files Included

- **api_reference.md** — Complete API, options, hooks, subagents
- **PATTERNS.md** — Code review, research, automation patterns
- **TOOLS.md** — Built-in tools and MCP integration
- **PRODUCTION.md** — Deployment, sandboxing, security, monitoring
- **create_agent.ts** — Script to generate new agent projects

### Data Sources

This skill was compiled from official Anthropic documentation and community resources:

- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — Anthropic Engineering blog
- [The Complete Guide to Building Agents](https://nader.substack.com/p/the-complete-guide-to-building-agents) — Nader Dabit's tutorial
- [Claude Agent SDK Demos](https://github.com/anthropics/claude-agent-sdk-demos) — Official demo repository
- [Claude Agent SDK Overview (video)](https://www.youtube.com/watch?v=TqC1qOfiVcQ) — Anthropic YouTube

---

## License

MIT
