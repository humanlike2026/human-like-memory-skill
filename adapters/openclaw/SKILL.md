---
name: human-like-memory
description: "HumanLike Memory / Human-Like Memory is a persistent AI agent memory system for long-term memory search, recall, and save. It helps agents store facts, preferences, and decisions and keep context across sessions for conversation continuity."
homepage: https://plugin.human-like.me
license: Apache-2.0
user-invocable: true
metadata: {"openclaw":{"emoji":"🧠","homepage":"https://plugin.human-like.me","requires":{"bins":["node"],"config":["skills.entries.human-like-memory.apiKey"]},"primaryEnv":"HUMAN_LIKE_MEM_API_KEY"}}
---

# Human-Like Memory Skill

OpenClaw adapter for Human-Like Memory.

## Use When

- The user asks to continue earlier work or recall prior context
- The answer would be materially better with memory across sessions
- The user explicitly asks to remember a preference, decision, correction, or summary

## Setup

```bash
openclaw config set skills.entries.human-like-memory.enabled true --strict-json
openclaw config set skills.entries.human-like-memory.apiKey "mp_your_key_here"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_BASE_URL "https://plugin.human-like.me"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_USER_ID "default-user"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_AGENT_ID "main"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SCENARIO "human-like-memory-skill"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_RECALL_ENABLED "true"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED "true"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS "5"
```

## Commands

```bash
node {baseDir}/scripts/memory.mjs config
node {baseDir}/scripts/memory.mjs recall "<query>"
node {baseDir}/scripts/memory.mjs search "<query>"
node {baseDir}/scripts/memory.mjs save "<user_message>" "<assistant_response>"
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | node {baseDir}/scripts/memory.mjs save-batch
```

## Agent Invocation Style

- Use `recall` / `search` when the user references prior work, prior preferences, or earlier decisions
- Use `save` when the user explicitly asks to remember something or states a durable fact
- Use `save-batch` only after a meaningful multi-turn discussion
- Do not call memory APIs for greetings or one-off questions with no continuity value

## Legacy Compatibility

If you need to read memory written under the historical OpenClaw namespace, override:

```bash
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SCENARIO "openclaw-plugin"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_AGENT_ID "main"
```
