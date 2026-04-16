---
name: human-like-memory
description: Recall prior conversations, search stored context, and save durable user facts or decisions to Human-Like Memory when continuity across sessions matters.
---

# Human-Like Memory

Claude Code adapter for Human-Like Memory.

## Use When

- The user asks to continue earlier work, resume a project, or recall prior decisions
- The answer would materially improve with past memory
- The user explicitly asks to remember a fact, preference, correction, or summary

## Setup

- Ensure `HUMAN_LIKE_MEM_API_KEY` is available in the Claude Code runtime environment
- Optional non-secret settings can be provided via `HUMAN_LIKE_MEM_*` environment variables or CLI flags

## Commands

```bash
node {baseDir}/scripts/memory.mjs config
node {baseDir}/scripts/memory.mjs recall "<query>"
node {baseDir}/scripts/memory.mjs search "<query>"
node {baseDir}/scripts/memory.mjs save "<user_message>" "<assistant_response>"
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | node {baseDir}/scripts/memory.mjs save-batch
```

## Invocation Guidance

- Use `recall` / `search` when earlier preferences, context, or decisions matter
- Use `save` when the user asks to remember something or confirms a durable fact
- Use `save-batch` only after a meaningful multi-turn exchange
- Do not use memory for simple greetings or context-free single-turn questions

## Legacy Compatibility

To share memory with the historical OpenClaw namespace, set:

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```
