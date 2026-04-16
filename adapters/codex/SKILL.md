---
name: human-like-memory
description: Recall prior conversations, search stored context, and save durable user facts or decisions to Human-Like Memory when continuity across sessions matters.
---

# Human-Like Memory

Codex adapter for Human-Like Memory.

## Use When

- The user asks to continue earlier work or recall past context
- The answer would improve with memory from prior sessions
- The user explicitly says to remember a preference, decision, correction, or summary

## Setup

- Ensure `HUMAN_LIKE_MEM_API_KEY` is available in the Codex runtime environment
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

- Use `recall` / `search` when prior project state, preferences, or decisions are relevant
- Use `save` when the user explicitly asks to remember something or confirms a durable fact
- Use `save-batch` only for meaningful multi-turn exchanges
- Avoid memory calls for simple greetings or one-off queries with no continuity value

## Legacy Compatibility

To share memory with the historical OpenClaw namespace, set:

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```
