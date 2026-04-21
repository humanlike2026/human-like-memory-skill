# Human-Like Memory Skill

HumanLike Memory 的单仓多适配 source-of-truth 仓库。

这个仓库不是某一个平台的“专属 skill 分支”，而是一套共享核心运行时，加上多个很薄的宿主适配层，用来把 HumanLike Memory 统一接到不同 AI Agent 上。

它的目标很明确：

- 用一份共享 runtime 统一 `recall` / `search` / `save` / `save-batch`
- 用平台 adapter 解决 OpenClaw、Hermes、Codex、Claude Code 的安装差异
- 避免继续维护一堆长期漂移的平台分支
- 让“安装说明”和“核心实现”分层清楚，后续更容易发布和维护

## 这个仓库适合谁

- 想把 HumanLike Memory 接到 OpenClaw、Hermes、Codex 或 Claude Code
- 想统一维护一套长期记忆协议，而不是在多个平台仓库里重复修同一个问题
- 想同时支持 skill 模式和部分宿主的深度集成模式

## 先看两个最重要的事实

### 1. 这个仓库的 `main` 分支是源码仓库，但也包含给 Claude Code / Codex 直装的 GitHub 安装目录

`adapters/` 里的目录是“包装层源码”，不一定是可以直接拿去安装的完整 skill。

这个仓库现在同时提供两类安装目标：

- 给维护者和本地分发使用的 build 产物：`dist/*`
- 给 Claude Code / Codex 直接从 GitHub 安装使用的提交目录：`install/*`

其中可直接从 GitHub 安装的完整目录是：

- `install/codex/human-like-memory`
- `install/claude-code/human-like-memory`

而本地构建和其它平台发布，仍然推荐通过下面的命令生成完整产物：

```bash
node scripts/build-distributions.mjs
```

生成后会得到四个自包含目录：

- `dist/openclaw/human-like-memory`
- `dist/hermes/human-like-memory`
- `dist/codex/human-like-memory`
- `dist/claude-code/human-like-memory`

同时也会刷新仓库内这两个 GitHub 直装目录：

- `install/codex/human-like-memory`
- `install/claude-code/human-like-memory`

这些目录里才会同时带上：

- 对应平台的 `SKILL.md`
- 平台 README
- `scripts/*.mjs`
- `docs/*`
- 平台额外需要的辅助文件

### 2. 在 Hermes 里，“安装 skill” 不等于 “切换 memory.provider”

这是最容易被忽略、但又最重要的细节。

如果你只是把 HumanLike Memory 作为 Hermes skill 安装进去，那么它只是多了一个可调用的 skill，不会自动把 Hermes 的原生 `memory.provider` 切换成 HumanLike。

如果你希望 Hermes 使用原生 provider 模式，安装完 skill 之后还要再执行一次本地 helper：

```bash
bash ~/.hermes/skills/human-like-memory/scripts/setup-hermes-provider.sh
```

这个脚本会做三件事：

- 从 npm 拉取 Hermes provider bundle
- 把 provider 挂到 Hermes 的 `plugins/memory/humanlike`
- 把 `~/.hermes/config.yaml` 里的 `memory.provider` 改成 `humanlike`

也就是说：

- “安装 skill” 解决的是技能可用
- “执行 provider setup” 解决的是 Hermes 原生记忆接管

## 平台支持矩阵

| 平台 | 推荐安装目标 | 推荐安装方式 | 是否需要额外步骤 |
|------|--------------|--------------|------------------|
| OpenClaw | `dist/openclaw/human-like-memory` | ClawHub 安装或复制到 workspace skill 目录 | 需要写入 `openclaw config` |
| Hermes Skill | `dist/hermes/human-like-memory` | 复制到 `~/.hermes/skills/human-like-memory` | 需要配置 API Key 和非敏感参数 |
| Hermes Provider | `dist/hermes/human-like-memory` + helper | 先装 skill，再执行 `setup-hermes-provider.sh` | 需要确认 `memory.provider=humanlike` 并重启 Hermes |
| Codex | `install/codex/human-like-memory` 或 `dist/codex/human-like-memory` | GitHub 直装或复制到 `~/.codex/skills` | 需要通过环境变量注入配置 |
| Claude Code | `install/claude-code/human-like-memory` 或 `dist/claude-code/human-like-memory` | GitHub 直装或复制到 `~/.claude/skills` | 需要通过环境变量注入配置 |

## 快速开始

### 1. 获取源码并生成分发产物

```bash
git clone https://github.com/humanlike2026/human-like-memory-skill.git
cd human-like-memory-skill
node scripts/build-distributions.mjs
```

### 2. 选择你的目标平台

- OpenClaw: 看 [docs/platforms/openclaw.md](docs/platforms/openclaw.md)
- Hermes: 看 [docs/platforms/hermes.md](docs/platforms/hermes.md)
- Codex: 看 [docs/platforms/codex.md](docs/platforms/codex.md)
- Claude Code: 看 [docs/platforms/claude-code.md](docs/platforms/claude-code.md)

### 3. 验证配置是否生效

每个平台最终都可以用同一条命令检查共享 runtime：

```bash
node /path/to/human-like-memory/scripts/memory.mjs config
```

只要输出里出现 `apiKeyConfigured: true`，就说明最关键的认证配置已经接通。

## GitHub 直接安装

如果你不想先 clone 仓库再本地 build，那么现在可以直接用仓库里提交好的 `install/` 目录来安装 Claude Code 和 Codex 版本。

### Codex：直接从 GitHub 安装

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --url https://github.com/humanlike2026/human-like-memory-skill/tree/main/install/codex/human-like-memory
```

安装完成后，建议重启 Codex。

### Claude Code：直接从 GitHub 安装

```bash
tmp_dir="$(mktemp -d)" && \
curl -L https://github.com/humanlike2026/human-like-memory-skill/archive/refs/heads/main.tar.gz | tar -xz -C "$tmp_dir" && \
mkdir -p "$HOME/.claude/skills" && \
rm -rf "$HOME/.claude/skills/human-like-memory" && \
cp -R "$tmp_dir/human-like-memory-skill-main/install/claude-code/human-like-memory" "$HOME/.claude/skills/human-like-memory" && \
rm -rf "$tmp_dir"
```

安装完成后，建议重启 Claude Code。

## 这个 skill 会做什么，不会做什么

### 会做什么

- 在用户要求延续上下文时召回相关历史记忆
- 在明确适合长期保存时，保存稳定偏好、关键决策、身份纠正和多轮总结
- 在多个宿主之间复用同一套记忆协议和运行时

### 不会做什么

- 不会默认每轮自动 recall
- 不会默认每轮静默保存
- 不会读取任意本地文件、shell history 或无关环境变量
- 不会在你没有调用 runtime 的情况下偷偷联网

## 数据与联网行为说明

当 Agent 或用户调用 HumanLike Memory 时，网络行为是显式且可预测的。

### `recall` / `search` 会发送

- 查询词 `query`
- `user_id`
- `agent_id`
- `scenario`
- 召回数量和最小相关度等检索参数

### `save` / `save-batch` 会发送

- 你明确传入的消息内容
- 默认优先使用 procedural memory 的 `v2/add/context`，必要时回退到旧版 `v1/add/message`
- 当输入里包含 assistant tool call / tool result 且未禁用捕获时，会一并写入结构化 `context_blocks`
- `user_id`
- `agent_id`
- `scenario`
- 用于分组写入的请求元数据

默认服务地址是：

```text
https://plugin.human-like.me
```

你也可以通过 `HUMAN_LIKE_MEM_BASE_URL` 指到自己的部署地址。

## 共享配置协议

所有平台共用同一套 `HUMAN_LIKE_MEM_*` 变量和 CLI flags。

### 必填

- `HUMAN_LIKE_MEM_API_KEY`

### 常用可选项

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

当前共享 runtime 的默认值是：

- `HUMAN_LIKE_MEM_BASE_URL=https://plugin.human-like.me`
- `HUMAN_LIKE_MEM_USER_ID=default-user`
- `HUMAN_LIKE_MEM_AGENT_ID=main`
- `HUMAN_LIKE_MEM_SCENARIO=human-like-memory-skill`

## 与历史 OpenClaw 记忆兼容

如果你要读取或继续写入历史 OpenClaw plugin 的记忆池，请显式切回旧命名空间：

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```

请记住，想要多个客户端共享同一批记忆，至少要对齐这三个维度：

- `user_id`
- `agent_id`
- `scenario`

只要三者有一个不一致，检索结果就可能对不上。

## 仓库结构

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
└── dist/                       # build 产物，默认不提交
```

各层职责如下：

- `core/`: 平台无关的共享运行时与配置协议
- `adapters/`: 平台包装层，例如 `SKILL.md` 和 manifest
- `install/`: 提交到仓库里的可直装目录，目前用于 Claude Code 和 Codex 的 GitHub 直接安装
- `integrations/`: 只有个别宿主才需要的深度接线逻辑
- `docs/platforms/`: 最终分发给各平台用户阅读的安装文档
- `scripts/build-distributions.mjs`: 负责把 `core + adapter + docs` 组装成可安装包

## 设计原则

- 共享能力只写一份：`memory.mjs`、配置协议、HTTP 调用逻辑都放在 `core/`
- 平台差异只放在 adapter：安装目录、提示文案、manifest、宿主元数据分别处理
- 深度集成单独拆开：例如 Hermes native provider，不和通用 skill 逻辑混在一起
- 分发依赖 build，不依赖长期平台分支
- 对外统一使用 `human-like-memory-skill`，不再把内部历史目录名当作产品命名

## 推荐验证命令

生成产物之后，至少建议跑一遍：

```bash
node scripts/build-distributions.mjs
node dist/codex/human-like-memory/scripts/memory.mjs config
node dist/hermes/human-like-memory/scripts/memory.mjs config
```

如果是 Hermes provider 模式，再额外确认：

- `setup-hermes-provider.sh` 已执行成功
- `~/.hermes/config.yaml` 中的 `memory.provider` 已切到 `humanlike`
- Hermes gateway 或当前 Hermes 进程已经重启

## 安全说明

详细说明见：

- [SECURITY.md](SECURITY.md)
- [core/docs/security-model.md](core/docs/security-model.md)
- [core/docs/shared-config.md](core/docs/shared-config.md)

## License

Apache-2.0
