# Security

This repository is structured so the security boundary is easier to inspect and explain.

At a high level:

- `core/` contains the actual runtime that talks to the memory service
- `adapters/` contain packaging and host-facing metadata
- `integrations/` contain host-specific helpers that are optional and explicit

That separation matters, because it makes it much easier to answer the most important question:

> what sends data, when, and under what conditions?

## Shared Runtime

The shared runtime lives in `core/`.

It:

- reads only documented `HUMAN_LIKE_MEM_*` variables plus explicit CLI flags
- contacts the memory service only when `recall`, `search`, `save`, or `save-batch` runs
- does not upload arbitrary local files, shell history, browser data, or unrelated environment variables

In other words, there is no hidden “always-on background uploader” inside the shared runtime.

The detailed model is documented in [core/docs/security-model.md](core/docs/security-model.md).

## What Triggers Network Requests

The runtime will contact the configured memory service only when one of these actions is invoked:

- `recall`
- `search`
- `save`
- `save-batch`

If none of those actions run, the runtime does not contact the memory service.

## What Data Is Sent

### Recall / Search

These requests send:

- the query
- `user_id`
- `agent_id`
- `scenario`
- retrieval settings such as memory limit and minimum score

### Save / Save-Batch

These requests send:

- the message content you explicitly choose to save
- `user_id`
- `agent_id`
- `scenario`
- request metadata used to group or identify the write

If you do not pass message content into a save command, the runtime has nothing to upload on your behalf.

## Adapters

Files in `adapters/` are thin wrappers:

- platform-specific `SKILL.md`
- platform-specific manifests such as OpenClaw `skill.json`
- installation-facing documentation

They do not introduce new memory transport behavior on their own.

They describe how the runtime should be used on a host, but they are not where the HTTP behavior lives.

## Integrations

Files in `integrations/` are explicitly host-specific and should be read as such.

The Hermes provider helper may:

- query npm for the provider package
- download the provider tarball
- update local Hermes config
- create or replace a local symlink inside Hermes

It only runs when the user or agent explicitly executes it.

That helper is not part of the generic shared runtime, and it does not send conversation history to npm. Its purpose is installation and local wiring.

## Build Step

`scripts/build-distributions.mjs` only assembles local files into `dist/`.

It does not contact the network and does not send user data anywhere.

## Practical Safety Advice

- Only provide `HUMAN_LIKE_MEM_API_KEY` if you trust the configured memory service
- Do not save passwords, private keys, tokens, or other secrets into HumanLike Memory
- If you are debugging cross-client recall, inspect `user_id`, `agent_id`, and `scenario` first
- If you want maximum auditability, read `core/scripts/memory.mjs` and `core/scripts/client.mjs` directly
