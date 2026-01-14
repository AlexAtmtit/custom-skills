# Claude Skills

A collection of custom skills for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## Skills

### 🔍 Codex Review in Ralph Loop

**[codex-review](./codex-review/)** — Automated code review using OpenAI's Codex CLI, running in a continuous improvement loop.

## The Magic Combo ✨

I discovered a nearly perfect workflow that gives me 99% ready results:

- **Main work** happens in Claude Code with Opus 4.5
- **Deep reviews** come from Codex CLI's `/review` command — it does incredibly thorough code analysis, way deeper than review features in other agents

I used to run Codex reviews manually, but now this skill lets Claude Code launch the review automatically. Combined with the **Ralph Wiggum technique** (loop until done), Claude Code will:

1. Run Codex review
2. Fix all found issues
3. Run review again
4. Repeat until Codex says everything is good

Now when I finish adding new code, I just kick off this loop and wait for it to polish everything automatically 🙂

## How It Works

### Prerequisites

1. **Ralph Wiggum plugin** — for running skills in a loop
2. **tmux** — Claude Code needs it to control CLI tools (otherwise it can't run the `/review` command)
3. **Codex CLI** — OpenAI's coding assistant

### Running the Loop

Start Claude Code in permissionless mode:

```bash
claude --permission-mode=dontAsk --allowedTools "Bash" "Edit" "Read" "Write"
```

Then run the magic command:

```bash
/ralph-loop:ralph-loop "Use the codex-review skill to review uncommitted changes. Run the skill to execute Codex CLI /review (option 2: Review uncommitted changes) Wait for Codex to complete (up to 60 minutes) Parse output for P0, P1, P2 issues If Codex asks questions, answer them yourself choosing the most logical, secure, and robust option for this project Fix ALL found issues (P0 first, then P1, then P2) Run the review again Output <promise>REVIEW_COMPLETE</promise> ONLY when Codex confirms no issues found (e.g., 'I did not identify any discrete bugs or regressions' or similar positive confirmation)." --completion-promise "REVIEW_COMPLETE" --max-iterations 50
```

That's it! Claude Code launches Codex, runs the review, makes fixes, runs it again — and keeps going until Codex confirms there are no more issues 🎉

## License

MIT
