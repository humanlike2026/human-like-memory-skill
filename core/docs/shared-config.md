# Shared Configuration

This document defines the canonical configuration contract shared by every adapter.

The point of this file is simple:

- OpenClaw should not invent one configuration model
- Hermes should not invent another
- Codex and Claude Code should not diverge on the same runtime settings

Every host may inject configuration differently, but the meaning of the settings must stay identical.

## Required

| Key | Default | CLI Flag | Description |
|-----|---------|----------|-------------|
| `HUMAN_LIKE_MEM_API_KEY` | none | none | API key for the Human-Like Memory service. |

This is the only truly mandatory setting. Without it, authenticated requests cannot be sent.

## Optional

| Key | Default | CLI Flag | Description |
|-----|---------|----------|-------------|
| `HUMAN_LIKE_MEM_BASE_URL` | `https://plugin.human-like.me` | `--base-url` | Service endpoint. |
| `HUMAN_LIKE_MEM_USER_ID` | `default-user` | `--user-id` | User isolation scope. |
| `HUMAN_LIKE_MEM_AGENT_ID` | `main` | `--agent-id` | Agent isolation scope. |
| `HUMAN_LIKE_MEM_SCENARIO` | `human-like-memory-skill` | `--scenario` | Shared workflow namespace used by both writes and searches. |
| `HUMAN_LIKE_MEM_LIMIT_NUMBER` | `6` | `--memory-limit` | Max memories returned per recall/search. |
| `HUMAN_LIKE_MEM_MIN_SCORE` | `0.1` | `--min-score` | Minimum relevance score. |
| `HUMAN_LIKE_MEM_TIMEOUT_MS` | `30000` | `--timeout-ms` | Request timeout in milliseconds. |
| `HUMAN_LIKE_MEM_RECALL_ENABLED` | `true` | `--recall-enabled` | Enables `recall` and `search`. |
| `HUMAN_LIKE_MEM_ADD_ENABLED` | `true` | `--add-enabled` | Enables `save` and `save-batch`. |
| `HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED` | `true` | `--auto-save-enabled` | Allows smart-trigger batch save behavior. |
| `HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS` | `5` | `--save-trigger-turns` | Suggested turn threshold before `save-batch`. |
| `HUMAN_LIKE_MEM_SAVE_MAX_MESSAGES` | `20` | `--save-max-messages` | Max messages included in `save-batch`. |
| `HUMAN_LIKE_MEM_USE_V2_PROTOCOL` | `true` | `--use-v2-protocol` | Prefer procedural-memory `v2/add/context` writes before falling back to v1. |
| `HUMAN_LIKE_MEM_CAPTURE_TOOL_CALLS` | `true` | `--capture-tool-calls` | Include assistant tool calls and tool results in procedural-memory context blocks. |

## What The Important Fields Mean

### `HUMAN_LIKE_MEM_USER_ID`

Use this to isolate memory between end users.

If two different people share the same `user_id`, they are effectively reading and writing into the same user namespace.

### `HUMAN_LIKE_MEM_AGENT_ID`

Use this to isolate memory between agent instances or agent roles.

Examples:

- one agent writes with `main`
- another writes with `assistant`
- a third writes with `researcher`

If you want them to share the same pool, they must use the same `agent_id`.

### `HUMAN_LIKE_MEM_SCENARIO`

This is the workflow namespace.

It affects both writes and searches, so it is one of the most common reasons cross-client recall appears to “not work”.

For example:

- one client writes under `human-like-memory-skill`
- another searches under `openclaw-plugin`

Even if `user_id` and `agent_id` match, those clients may not hit the same memory pool.

## CLI Flags Mirror The Same Contract

All optional settings can also be passed as CLI flags.

Example:

```bash
node scripts/memory.mjs recall "recent roadmap decisions" \
  --user-id "demo-user" \
  --agent-id "main" \
  --scenario "human-like-memory-skill" \
  --memory-limit "8" \
  --min-score "0.2"
```

Use CLI flags when:

- the host platform cannot easily inject environment variables
- you want a one-off override for a specific command
- you want host config values converted into explicit command arguments

For procedural-memory writes:

- leave `--use-v2-protocol` enabled for the default behavior
- disable `--capture-tool-calls` if the host should store only user/assistant dialogue

## Interoperability

The canonical default scenario is:

```text
human-like-memory-skill
```

If you need compatibility with older memory written under the historical OpenClaw namespace, explicitly set:

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```

## Rule Of Thumb For Shared Memory

When multiple hosts should read and write the same memory pool, align all three of:

- `user_id`
- `agent_id`
- `scenario`

If one host cannot recall what another host saved, the first place to check is not the API key. It is usually one of these three values.
