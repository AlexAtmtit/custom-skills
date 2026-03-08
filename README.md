# Custom Skills for Claude Code, Droid, and Codex

My collection of custom skills for Claude Code, Droid, and Codex.

## Skills

| Skill | Description |
|-------|-------------|
| [🔍 codex-review](#-codex-review) | Automated code review using Codex CLI with Ralph Wiggum loop for continuous improvement |
| [🤖 claude-agent-sdk](#-claude-agent-sdk) | Reference docs that help Claude Code build agents using `@anthropic-ai/claude-agent-sdk` |
| [🔒 openclaw-vps-setup](#-openclaw-vps-setup) | Securely deploy OpenClaw autonomous AI agent on a Hetzner VPS with full hardening and end-to-end security verification |

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

**[claude-agent-sdk](./claude-agent-sdk/)** — Reference documentation that helps Claude Code build agents using `@anthropic-ai/claude-agent-sdk`. When you ask Claude to create an agent project, this skill provides the API patterns, tool configurations, and production best practices it needs.

### What This Skill Does

This skill loads reference documentation into Claude's context when working with the Claude Agent SDK. Instead of Claude guessing at APIs or hallucinating patterns, it has access to:

- Correct `query()` API syntax and options
- Working code examples for common agent types
- Hook configurations for permissions and auditing
- Subagent patterns for parallel work
- MCP integration for external services
- Production deployment and security guidelines

### When Claude Uses This Skill

The skill activates automatically when you're working with code that imports from `@anthropic-ai/claude-agent-sdk` or when you ask Claude to build an agent project.

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

## 🔒 openclaw-vps-setup

**[openclaw-vps-setup](./openclaw-vps-setup/)** — A step-by-step interactive guide that walks you through deploying [OpenClaw](https://openclaw.ai) (an autonomous AI agent) on a Hetzner VPS with production-grade security. The skill adapts to your experience level — beginners get explanations for every concept, experienced users get a streamlined flow.

Most OpenClaw setups found online are dangerously insecure: exposed to the public internet, running as root, with no VPN or firewall. This skill implements every security layer properly and verifies each one with actual tests.

### Security Model

The deployment uses layered security — no single point of failure:

- **SSH bound to Tailscale VPN only** — the server is invisible on the public internet, no port 22 exposed
- **Non-root user for the bot process** — limits blast radius if the bot is compromised
- **Gateway on loopback only (127.0.0.1)** — the dashboard is only accessible via SSH tunnel, never from the network
- **UFW firewall denies all incoming** except Tailscale's UDP port (41641)
- **Password authentication disabled** — Tailscale SSH handles authentication, no passwords to brute-force
- **Token authentication on the gateway dashboard** — extra layer even through the SSH tunnel
- **Voice processing (Whisper) runs locally** — no voice data leaves the server
- **Claude subscription tokens explicitly blocked** — using them with OpenClaw results in a permanent Anthropic account ban

### How It Works

The skill guides you through a 7-step conversation:

1. **Assess prerequisites** — checks your experience level, Hetzner account, Tailscale account, LLM API keys, Telegram
2. **Provision VPS** — walks you through creating a Hetzner CX33 (4 vCPU, 8GB RAM, ~€7.50/month)
3. **Harden the server** — system updates, Tailscale VPN, non-root user, SSH lockdown, UFW firewall
4. **Install OpenClaw** — manual configuration with secure defaults (loopback gateway, token auth)
5. **Telegram bot setup** — create bot via BotFather, pair with OpenClaw, optional local voice mode
6. **Configure skills** — memory system, heartbeat, identity, individual skills with data-flow explanations
7. **Security verification** — 10 mandatory tests that must all pass before the setup is considered complete

### Security Verification (10 Mandatory Checks)

Every check must pass — the skill will not skip any:

1. **Public SSH blocked** — connecting via public IP must fail (timeout/refused)
2. **Tailscale SSH works** — connecting via Tailscale IP must succeed
3. **Root login disabled** — `ssh root@<tailscale-ip>` must be rejected
4. **Firewall rules correct** — only UDP 41641 allowed in, default deny everything else
5. **OpenClaw runs as non-root** — process owner is the dedicated user, not root
6. **Gateway is loopback-only** — listens on 127.0.0.1:18789, not 0.0.0.0
7. **Tailscale disconnect = total isolation** — disconnecting VPN makes server completely unreachable
8. **Telegram bot responds** — bot processes and replies to messages
9. **Password auth disabled** — SSH rejects password-based login attempts
10. **No unnecessary services exposed** — no services listening on 0.0.0.0

### LLM Provider Options

- **Anthropic API key** (recommended) — pay-per-token from console.anthropic.com, explicitly allowed for programmatic use
- **OpenAI API key** — from platform.openai.com for GPT models
- **ChatGPT Plus/Pro OAuth** — works via PKCE flow, but **at your own risk** (OpenAI ToS may change)
- **OpenRouter API key** — aggregator with access to many models through one key
- ⚠️ **Claude subscription tokens are strictly prohibited** — using them with OpenClaw = permanent Anthropic account ban, no exceptions

### Reference Files

- **[SKILL.md](./openclaw-vps-setup/SKILL.md)** — Conversation flow, behavioral rules, and security philosophy
- **[references/setup-guide.md](./openclaw-vps-setup/references/setup-guide.md)** — Complete command-by-command instructions for all phases
- **[references/security-checklist.md](./openclaw-vps-setup/references/security-checklist.md)** — Full verification procedure with expected outputs for each test

---

## License

MIT
