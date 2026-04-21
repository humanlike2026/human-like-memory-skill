# Human-Like Memory Skill

The single-repository, multi-adapter source of truth for HumanLike Memory.

This repository is not a one-platform-only skill package. It is a shared runtime plus thin host adapters so HumanLike Memory can be maintained once and shipped consistently across multiple AI agents.

Its goals are:

- keep one shared implementation of `recall`, `search`, `save`, and `save-batch`
- isolate host-specific installation and packaging details in adapters
- avoid long-lived per-platform branches that drift over time
- make installation docs, runtime behavior, and deep integrations easier to reason about

## Who This Repository Is For

- teams maintaining HumanLike Memory across multiple agent hosts
- users installing HumanLike Memory into OpenClaw, Hermes, Codex, or Claude Code
- maintainers who want one canonical runtime instead of duplicated platform forks

## Two Important Facts Before You Install

### 1. `main` is a source repository, but it also contains committed GitHub install targets for Claude Code and Codex

Directories under `adapters/` are source-level wrappers. They are not always the complete end-user install target by themselves.

This repository now exposes two kinds of install targets:

- build outputs for local packaging and release work: `dist/*`
- committed GitHub-installable directories for Claude Code and Codex: `install/*`

The direct GitHub install paths are:

- `install/codex/human-like-memory`
- `install/claude-code/human-like-memory`

Generate installable packages with:

```bash
node scripts/build-distributions.mjs
```

That produces four self-contained outputs:

- `dist/openclaw/human-like-memory`
- `dist/hermes/human-like-memory`
- `dist/codex/human-like-memory`
- `dist/claude-code/human-like-memory`

The same build command also refreshes the committed GitHub install targets:

- `install/codex/human-like-memory`
- `install/claude-code/human-like-memory`

Each output contains:

- the platform-specific `SKILL.md`
- a platform README
- `scripts/*.mjs`
- shared docs
- any extra files required by that host

### 2. In Hermes, installing the skill is not the same as switching `memory.provider`

This is the most important integration detail.

If you only install the Hermes skill, HumanLike Memory becomes a callable skill. Hermes will not automatically switch its native `memory.provider`.

If you want native provider mode, you must run the local helper after installing the skill:

```bash
bash ~/.hermes/skills/human-like-memory/scripts/setup-hermes-provider.sh
```

That helper will:

- download the Hermes provider bundle from npm
- link the provider into Hermes under `plugins/memory/humanlike`
- update `~/.hermes/config.yaml` so `memory.provider` becomes `humanlike`

In short:

- skill install makes the capability available
- provider setup makes Hermes use HumanLike as its native memory backend

## Platform Matrix

| Platform | Recommended install target | Recommended install method | Extra step |
|----------|----------------------------|----------------------------|------------|
| OpenClaw | `dist/openclaw/human-like-memory` | ClawHub install or copy into a workspace skill directory | Configure `openclaw config` |
| Hermes Skill | `dist/hermes/human-like-memory` | Copy into `~/.hermes/skills/human-like-memory` | Configure API key and non-secret settings |
| Hermes Provider | `dist/hermes/human-like-memory` + helper | Install skill first, then run `setup-hermes-provider.sh` | Confirm `memory.provider=humanlike` and restart Hermes |
| Codex | `install/codex/human-like-memory` or `dist/codex/human-like-memory` | Direct GitHub install or copy into `~/.codex/skills` | Inject settings with environment variables |
| Claude Code | `install/claude-code/human-like-memory` or `dist/claude-code/human-like-memory` | Direct GitHub install or copy into `~/.claude/skills` | Inject settings with environment variables |

## Quick Start

### 1. Clone and build

```bash
git clone https://github.com/humanlike2026/human-like-memory-skill.git
cd human-like-memory-skill
node scripts/build-distributions.mjs
```

### 2. Pick the guide for your host

- [OpenClaw](docs/platforms/openclaw.md)
- [Hermes](docs/platforms/hermes.md)
- [Codex](docs/platforms/codex.md)
- [Claude Code](docs/platforms/claude-code.md)

### 3. Verify the runtime

All hosts ultimately use the same shared runtime:

```bash
node /path/to/human-like-memory/scripts/memory.mjs config
```

If the output shows `apiKeyConfigured: true`, the core authentication path is wired correctly.

## Direct GitHub Install

If you do not want to clone the repo and build locally first, the repository now includes committed install targets for Codex and Claude Code.

### Codex: install directly from GitHub

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --url https://github.com/humanlike2026/human-like-memory-skill/tree/main/install/codex/human-like-memory
```

Restart Codex after installation.

### Claude Code: install directly from GitHub

```bash
tmp_dir="$(mktemp -d)" && \
curl -L https://github.com/humanlike2026/human-like-memory-skill/archive/refs/heads/main.tar.gz | tar -xz -C "$tmp_dir" && \
mkdir -p "$HOME/.claude/skills" && \
rm -rf "$HOME/.claude/skills/human-like-memory" && \
cp -R "$tmp_dir/human-like-memory-skill-main/install/claude-code/human-like-memory" "$HOME/.claude/skills/human-like-memory" && \
rm -rf "$tmp_dir"
```

Restart Claude Code after installation.

## What The Skill Does And Does Not Do

### It does

- recall prior context when continuity matters
- search stored memory by topic
- save durable facts, preferences, decisions, and summaries
- reuse one runtime contract across multiple hosts

### It does not

- run automatic recall on every turn by default
- silently save every turn by default
- read arbitrary local files, shell history, or unrelated environment variables
- contact the memory service when the runtime is not invoked

## Data And Network Behavior

Network requests are explicit and predictable.

### `recall` / `search` send

- the query
- `user_id`
- `agent_id`
- `scenario`
- retrieval settings such as memory limit and minimum score

### `save` / `save-batch` send

- the message content you explicitly pass in
- procedural-memory `v2/add/context` by default, with automatic fallback to legacy `v1/add/message`
- structured `context_blocks`, including assistant tool calls and tool results when capture is enabled
- `user_id`
- `agent_id`
- `scenario`
- request metadata used to group or identify the save

Default endpoint:

```text
https://plugin.human-like.me
```

You can override it with `HUMAN_LIKE_MEM_BASE_URL`.

## Shared Configuration Contract

All platforms use the same `HUMAN_LIKE_MEM_*` variables and CLI flags.

### Required

- `HUMAN_LIKE_MEM_API_KEY`

### Common optional settings

- `HUMAN_LIKE_MEM_BASE_URL`
- `HUMAN_LIKE_MEM_USER_ID`
- `HUMAN_LIKE_MEM_AGENT_ID`
- `HUMAN_LIKE_MEM_SCENARIO`
- `HUMAN_LIKE_MEM_LIMIT_NUMBER`
- `HUMAN_LIKE_MEM_MIN_SCORE`
- `HUMAN_LIKE_MEM_RECALL_ENABLED`
- `HUMAN_LIKE_MEM_ADD_ENABLED`
- `HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED`
- `HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS`
- `HUMAN_LIKE_MEM_SAVE_MAX_MESSAGES`
- `HUMAN_LIKE_MEM_USE_V2_PROTOCOL`
- `HUMAN_LIKE_MEM_CAPTURE_TOOL_CALLS`
- `HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS`

Current shared defaults:

- `HUMAN_LIKE_MEM_BASE_URL=https://plugin.human-like.me`
- `HUMAN_LIKE_MEM_USER_ID=default-user`
- `HUMAN_LIKE_MEM_AGENT_ID=main`
- `HUMAN_LIKE_MEM_SCENARIO=human-like-memory-skill`

## Compatibility With Historical OpenClaw Memory

To read or keep writing into the historical OpenClaw namespace, explicitly switch back:

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```

To share memory across clients, align all three of:

- `user_id`
- `agent_id`
- `scenario`

If any one of them differs, reads and writes may no longer hit the same memory pool.

## Repository Layout

```text
human-like-memory-skill/
├── core/
│   ├── scripts/
│   │   ├── client.mjs
│   │   ├── config.mjs
│   │   └── memory.mjs
│   └── docs/
│       ├── security-model.md
│       └── shared-config.md
├── adapters/
│   ├── openclaw/
│   ├── hermes/
│   ├── codex/
│   └── claude-code/
├── install/
│   ├── codex/
│   └── claude-code/
├── integrations/
│   └── hermes-provider/
├── docs/
│   └── platforms/
├── scripts/
│   └── build-distributions.mjs
└── dist/                       # generated output, ignored by default
```

Responsibilities:

- `core/`: platform-neutral runtime and config contract
- `adapters/`: thin host wrappers such as `SKILL.md` and manifests
- `install/`: committed direct-install directories, currently for Claude Code and Codex
- `integrations/`: deeper host-only wiring such as Hermes provider setup
- `docs/platforms/`: install guides copied into final distributions
- `scripts/build-distributions.mjs`: assembles full installable packages

## Design Principles

- shared behavior lives once in `core/`
- host differences stay inside adapters
- deep integrations are isolated from generic skill logic
- distribution happens through a build step, not platform branches
- the outward-facing product name is standardized as `human-like-memory-skill`

## Recommended Verification

After building, a minimal check is:

```bash
node scripts/build-distributions.mjs
node dist/codex/human-like-memory/scripts/memory.mjs config
node dist/hermes/human-like-memory/scripts/memory.mjs config
```

For Hermes provider mode, also confirm:

- `setup-hermes-provider.sh` completed successfully
- `memory.provider` in `~/.hermes/config.yaml` is now `humanlike`
- the Hermes gateway or current Hermes process has been restarted

## Security

See:

- [SECURITY.md](SECURITY.md)
- [core/docs/security-model.md](core/docs/security-model.md)
- [core/docs/shared-config.md](core/docs/shared-config.md)

## License

Apache-2.0
