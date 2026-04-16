# OpenClaw

本指南说明如何把 HumanLike Memory 作为 OpenClaw skill 安装和配置。

## 这个适配层的定位

OpenClaw 版本是一个“智能触发的 skill”，不是每轮静默运行的 plugin。

它适合这些场景：

- 用户要求继续之前的话题、项目或决策
- Agent 明显需要历史上下文才能回答得更好
- 用户明确说“记住这个偏好 / 决策 / 纠正 / 结论”

它不适合这些场景：

- 你想要每轮自动 recall
- 你想要完全后台化的 hook 记忆
- 你希望所有对话都在用户无感知的情况下自动保存

如果你要的是“全自动长期记忆”，应优先考虑 OpenClaw plugin 方案，而不是 skill 方案。

## 安装方式

### 方式 A：从 ClawHub 安装

如果你已经在 OpenClaw 生态里使用 ClawHub，最简单的方式就是：

```bash
openclaw skills install human-like-memory
```

OpenClaw 会把 skill 下载到当前 workspace 的 `skills/` 目录，下次会话会自动加载。

### 方式 B：从源码仓库生成安装包再复制

这个仓库的 `main` 分支是源码，不是最终分发目录。推荐先生成完整产物：

```bash
git clone https://github.com/humanlike2026/human-like-memory-skill.git
cd human-like-memory-skill
node scripts/build-distributions.mjs
```

然后把 OpenClaw 产物复制到你的 workspace：

```bash
mkdir -p ./skills
cp -R dist/openclaw/human-like-memory ./skills/human-like-memory
```

如果你使用的是本地全局 skill 目录，也可以复制到：

```bash
~/.openclaw/skills/human-like-memory
```

## 配置步骤

### 1. 获取 API Key

访问 [plugin.human-like.me](https://plugin.human-like.me) 获取你的 `mp_xxx` key。

### 2. 写入 OpenClaw 配置

建议的最小配置如下：

```bash
openclaw config set skills.entries.human-like-memory.enabled true --strict-json
openclaw config set skills.entries.human-like-memory.apiKey "mp_your_key_here"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_BASE_URL "https://plugin.human-like.me"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_USER_ID "default-user"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_AGENT_ID "main"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SCENARIO "human-like-memory-skill"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_RECALL_ENABLED "true"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_ADD_ENABLED "true"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED "true"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS "5"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SAVE_MAX_MESSAGES "20"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_MIN_SCORE "0.1"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_LIMIT_NUMBER "6"
```

### 3. 这些配置分别是什么意思

- `apiKey`: HumanLike Memory 的认证密钥
- `HUMAN_LIKE_MEM_BASE_URL`: 服务地址，默认是官方托管地址
- `HUMAN_LIKE_MEM_USER_ID`: 用户隔离标识
- `HUMAN_LIKE_MEM_AGENT_ID`: Agent 隔离标识
- `HUMAN_LIKE_MEM_SCENARIO`: 记忆命名空间，决定读写是否命中同一个池子
- `HUMAN_LIKE_MEM_RECALL_ENABLED`: 是否允许 recall / search
- `HUMAN_LIKE_MEM_ADD_ENABLED`: 是否允许 save / save-batch
- `HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED`: 是否允许 Agent 在合适时机用 `save-batch`
- `HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS`: 建议多少轮后再考虑批量保存
- `HUMAN_LIKE_MEM_LIMIT_NUMBER`: 单次最多返回多少条记忆
- `HUMAN_LIKE_MEM_MIN_SCORE`: 最低相关度阈值

## 验证

安装和配置完成后，先跑：

```bash
node ./skills/human-like-memory/scripts/memory.mjs config
```

如果你装在 `~/.openclaw/skills` 下，则改成：

```bash
node ~/.openclaw/skills/human-like-memory/scripts/memory.mjs config
```

理想输出里至少要看到：

```json
{
  "apiKeyConfigured": true
}
```

然后再做一个简单召回测试：

```bash
node ./skills/human-like-memory/scripts/memory.mjs recall "我最近在推进什么项目"
```

## 典型用法

### 检查配置

```bash
node ./skills/human-like-memory/scripts/memory.mjs config
```

### 召回或搜索记忆

```bash
node ./skills/human-like-memory/scripts/memory.mjs recall "上次路线图里确认了什么"
node ./skills/human-like-memory/scripts/memory.mjs search "我提过什么命名偏好"
```

### 保存单轮结论

```bash
node ./skills/human-like-memory/scripts/memory.mjs save \
  "我默认使用北京时间" \
  "收到，我会在相关场景里沿用这个偏好"
```

### 批量保存多轮对话

```bash
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | \
  node ./skills/human-like-memory/scripts/memory.mjs save-batch
```

## 与历史 OpenClaw 记忆兼容

如果你需要继续读取历史 OpenClaw plugin 写入的记忆，请显式切回旧命名空间：

```bash
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_SCENARIO "openclaw-plugin"
openclaw config set skills.entries.human-like-memory.env.HUMAN_LIKE_MEM_AGENT_ID "main"
```

如果你同时还在让其他 Agent 共用同一批记忆，请确保这些值与对方完全一致：

- `user_id`
- `agent_id`
- `scenario`

## 使用建议

- 当用户提到“上次”“之前”“继续推进”“还记得吗”时，优先考虑 `recall` 或 `search`
- 当用户明确说“记住这个”或确认了稳定偏好、重要决策、身份纠正时，优先考虑 `save`
- 只有在一段多轮对话已经沉淀出长期价值时，才使用 `save-batch`
- 简单寒暄、一次性问答、无连续性价值的请求，不要强行使用记忆

## 常见问题

### 1. 安装后 skill 没有生效

先检查两件事：

- 你是否启动了新的 OpenClaw 会话
- skill 是否确实位于当前 workspace 的 `skills/` 目录或 `~/.openclaw/skills/`

### 2. `config` 能跑，但总是召回不到历史记忆

最常见原因是命名空间不一致。检查：

- `HUMAN_LIKE_MEM_USER_ID`
- `HUMAN_LIKE_MEM_AGENT_ID`
- `HUMAN_LIKE_MEM_SCENARIO`

只要这三项和历史写入值对不上，检索就会像“没有记忆”一样。

### 3. 我想每轮都自动记忆

这不是 skill 的目标场景。请改用插件或其它自动化接线方式。
