---
name: human-like-memory
description: HumanLike Memory / Human-Like Memory agent memory skill for long-term memory recall, memory search, memory save, and conversation continuity across sessions.
version: "2.0.0"
license: Apache-2.0
compatibility: Requires Node.js 18+ and network access to the configured Human-Like Memory service.
metadata:
  author: humanlike2026
  hermes:
    tags: [productivity, memory, continuity, recall]
    category: productivity
    config:
      - key: human-like-memory.base_url
        description: Base URL for the Human-Like Memory service
        default: https://plugin.human-like.me
        prompt: Human-Like Memory service base URL
      - key: human-like-memory.user_id
        description: User identifier used for memory isolation
        default: default-user
        prompt: Human-Like Memory user ID
      - key: human-like-memory.agent_id
        description: Agent identifier used for memory isolation
        default: main
        prompt: Human-Like Memory agent ID
      - key: human-like-memory.scenario
        description: Scenario name used for both memory writes and searches
        default: human-like-memory-skill
        prompt: Human-Like Memory scenario
      - key: human-like-memory.memory_limit_number
        description: Maximum number of memories to retrieve per recall
        default: "6"
        prompt: Human-Like Memory recall limit
      - key: human-like-memory.min_score
        description: Minimum relevance score for retrieved memories
        default: "0.1"
        prompt: Human-Like Memory minimum score
      - key: human-like-memory.recall_enabled
        description: Whether recall and search requests are enabled
        default: "true"
        prompt: Enable Human-Like Memory recall
      - key: human-like-memory.add_enabled
        description: Whether save and save-batch requests are enabled
        default: "true"
        prompt: Enable Human-Like Memory save
      - key: human-like-memory.auto_save_enabled
        description: Whether the agent may use save-batch after a meaningful multi-turn exchange
        default: "true"
        prompt: Enable Human-Like Memory auto save
      - key: human-like-memory.save_trigger_turns
        description: Suggested number of turns before the agent considers save-batch
        default: "5"
        prompt: Human-Like Memory save trigger turns
required_environment_variables:
  - name: HUMAN_LIKE_MEM_API_KEY
    prompt: Human-Like Memory API key
    help: Get a key from https://plugin.human-like.me
    required_for: recall, search, save, and save-batch commands
---

# Human-Like Memory Skill

Hermes adapter for Human-Like Memory.

## When to Use

- The user asks to continue earlier work, recall prior discussions, or search old context
- The user explicitly asks to remember a preference, decision, correction, or summary
- The answer would be materially better with continuity from previous sessions

## Quick Reference

```bash
node {baseDir}/scripts/memory.mjs config
node {baseDir}/scripts/memory.mjs recall "roadmap decisions from last week"
node {baseDir}/scripts/memory.mjs search "what timezone preference did I mention"
node {baseDir}/scripts/memory.mjs save "I prefer UTC+8 timestamps" "Understood."
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | node {baseDir}/scripts/memory.mjs save-batch
```

## Setup

- Ensure `HUMAN_LIKE_MEM_API_KEY` exists in the Hermes environment
- Provide non-secret settings through Hermes config, env vars, or CLI flags
- If native Hermes `memory.provider` integration is desired, run:

```bash
bash {baseDir}/scripts/setup-hermes-provider.sh
```

## Legacy Compatibility

If you need to read memory written under the historical OpenClaw namespace, align:

- `HUMAN_LIKE_MEM_SCENARIO=openclaw-plugin`
- `HUMAN_LIKE_MEM_AGENT_ID=main`
