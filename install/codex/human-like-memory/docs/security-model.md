# Security Model

This document describes the shared runtime behavior across all adapters.

## Runtime Security Posture

- No automatic every-turn recall
- No hook-level silent background save
- No upload of arbitrary local files or shell history
- Memory network traffic happens only when a skill command is invoked

## What Triggers Network Requests

Requests to the memory service happen only when one of these commands runs:

- `recall`
- `search`
- `save`
- `save-batch`

If you do not invoke the runtime, it does not contact the service.

## What Data Is Sent

### `recall` / `search`

- `query`
- `user_id`
- `agent_id`
- retrieval settings such as `memory_limit_number` and `min_score`
- optional `scenario`

### `save` / `save-batch`

- the message content you explicitly provide
- `user_id`
- `agent_id`
- generated `conversation_id`
- generated request metadata used to group the save request
- fixed tag `human-like-memory-skill`

## What The Runtime Reads

The shared runtime reads only:

- `HUMAN_LIKE_MEM_API_KEY`
- documented `HUMAN_LIKE_MEM_*` environment variables
- optional CLI flags explicitly passed to `memory.mjs`

The runtime does not read:

- arbitrary local project files
- browser data
- shell history
- unrelated environment variables

## Integrations

Host-specific deep integrations live outside `core/`.

The Hermes provider helper in `integrations/hermes-provider/` is optional and only runs when explicitly executed. It may talk to npm and update local Hermes files, but it does not send memory content or conversation history to npm.
