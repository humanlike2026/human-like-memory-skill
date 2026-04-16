# Hermes

本指南同时覆盖两种接法：

- Hermes Skill 模式
- Hermes 原生 `memory.provider` 模式

这两种模式是相关但不相同的，请不要混在一起理解。

## 两种模式的区别

| 模式 | 作用 | 安装后会发生什么 | 适合谁 |
|------|------|------------------|--------|
| Skill 模式 | 把 HumanLike Memory 作为可调用 skill 加入 Hermes | Hermes 可以按需调用 `recall / search / save / save-batch` | 想保留 skill 调用模型的人 |
| Provider 模式 | 把 HumanLike 接成 Hermes 原生 `memory.provider` | Hermes 原生记忆能力切到 HumanLike | 想让 Hermes 真正把 HumanLike 当底层记忆后端的人 |

最关键的提醒是：

> 只安装 skill，不会自动切换 `memory.provider`。

如果你想要 provider 模式，安装完 skill 后还要再执行一次本地 setup 脚本。

## 第一步：生成 Hermes 可安装产物

```bash
git clone https://github.com/humanlike2026/human-like-memory-skill.git
cd human-like-memory-skill
node scripts/build-distributions.mjs
```

Hermes 用到的完整目录是：

```text
dist/hermes/human-like-memory
```

## 方式 A：Hermes Skill 模式

### 1. 安装 skill

```bash
mkdir -p ~/.hermes/skills
cp -R dist/hermes/human-like-memory ~/.hermes/skills/human-like-memory
```

### 2. 配置 API Key

```bash
hermes config set HUMAN_LIKE_MEM_API_KEY "mp_xxx"
```

### 3. 配置非敏感参数

如果你希望 Hermes skill 模式使用明确的用户、Agent 和场景隔离，建议把这些参数写清楚：

```bash
hermes config set skills.config.human-like-memory.base_url "https://plugin.human-like.me"
hermes config set skills.config.human-like-memory.user_id "default-user"
hermes config set skills.config.human-like-memory.agent_id "main"
hermes config set skills.config.human-like-memory.scenario "human-like-memory-skill"
hermes config set skills.config.human-like-memory.memory_limit_number "6"
hermes config set skills.config.human-like-memory.min_score "0.1"
hermes config set skills.config.human-like-memory.recall_enabled "true"
hermes config set skills.config.human-like-memory.add_enabled "true"
hermes config set skills.config.human-like-memory.auto_save_enabled "true"
hermes config set skills.config.human-like-memory.save_trigger_turns "5"
```

### 4. 验证 skill 模式

```bash
node ~/.hermes/skills/human-like-memory/scripts/memory.mjs config
```

如果输出里 `apiKeyConfigured` 是 `true`，说明最关键的认证已经到位。

## 方式 B：Hermes 原生 Provider 模式

如果你想让 Hermes 原生记忆后端变成 HumanLike，请在 skill 安装完成之后，再执行：

```bash
bash ~/.hermes/skills/human-like-memory/scripts/setup-hermes-provider.sh
```

这个 helper 会自动完成以下工作：

- 检查 Hermes 本地环境是否存在
- 从 npm 获取 `@humanlikememory/human-like-mem-hermes-plugin`
- 解压 provider bundle 到 `~/.hermes/humanlike-memory-provider`
- 将 provider 挂到 `~/.hermes/hermes-agent/plugins/memory/humanlike`
- 更新 `~/.hermes/config.yaml`
- 把 `memory.provider` 切换成 `humanlike`

### 安装完成后必须确认的事情

#### 1. `memory.provider` 已切换

你可以直接检查：

```bash
rg -n "provider:\\s*humanlike" ~/.hermes/config.yaml
```

如果没有安装 `rg`，也可以直接打开 `~/.hermes/config.yaml` 看 `memory.provider` 是否已经是：

```yaml
memory:
  provider: humanlike
```

#### 2. API Key 已存在

helper 会提示你检查：

```text
~/.hermes/.env
```

如果这里还没有 `HUMAN_LIKE_MEM_API_KEY`，请补上。

#### 3. Hermes 已重启

安装完成后，重启 Hermes gateway 或当前 Hermes 进程：

```bash
hermes gateway restart
```

如果你当前 Hermes CLI 会话已经启动，也建议重新进入会话。

## 一个非常容易踩的坑

很多人会以为“我已经把 skill 目录复制到 `~/.hermes/skills/human-like-memory` 了，所以 Hermes 一定已经在用 HumanLike 做原生 memory”。

这其实是不对的。

仅复制 skill 目录，只是让 Hermes 可以调用这个 skill；它不会主动改你的 `config.yaml`，也不会自动把 `memory.provider` 改成 `humanlike`。

只有在你明确执行了：

```bash
bash ~/.hermes/skills/human-like-memory/scripts/setup-hermes-provider.sh
```

之后，Hermes 才会切到原生 provider 模式。

## 与历史 OpenClaw 记忆兼容

如果你希望 Hermes 读取历史 OpenClaw plugin 写入的记忆，请改成旧命名空间：

```bash
hermes config set skills.config.human-like-memory.scenario "openclaw-plugin"
hermes config set skills.config.human-like-memory.agent_id "main"
```

如果你是通过环境变量注入，则等价写法为：

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```

只要其他客户端也使用同样的 `user_id / agent_id / scenario`，就能共用同一个记忆池。

## 推荐用法

- 你只想把 HumanLike 当作一个按需调用的长期记忆技能时，用 Skill 模式
- 你想让 Hermes 整体改用 HumanLike 作为底层记忆服务时，用 Provider 模式
- 你已经安装了 skill 但 provider 没切过去时，优先检查有没有跑 helper 脚本

## 常见问题

### 1. 我已经装了 skill，但 Hermes 还是没走 HumanLike provider

先确认你有没有执行：

```bash
bash ~/.hermes/skills/human-like-memory/scripts/setup-hermes-provider.sh
```

没有执行的话，这就是原因。

### 2. provider 已经切过去了，但还是搜不到旧记忆

优先检查三项是否与历史写入时一致：

- `user_id`
- `agent_id`
- `scenario`

### 3. helper 脚本执行成功了，但会话表现还是旧的

通常是 Hermes 进程还没重启。先执行：

```bash
hermes gateway restart
```

然后重新开始会话。
