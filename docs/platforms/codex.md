# Codex

本指南说明如何把 HumanLike Memory 安装到 Codex。

## 一个重要前提

这个仓库现在给 Codex 提供两种正确的安装目标：

- GitHub 直接安装路径：`install/codex/human-like-memory`
- 本地 build 产物：`dist/codex/human-like-memory`

`adapters/codex/` 仍然只是源码层包装目录，不是最终面向 Codex 用户的完整安装包。

也就是说，如果你想从 GitHub 直接安装，就指向 `install/codex/human-like-memory`；如果你是本地 clone 仓库再打包，就使用 `dist/codex/human-like-memory`。

## 从 GitHub 直接安装

Codex 自带的 GitHub 安装器可以直接安装这个 skill：

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --url https://github.com/humanlike2026/human-like-memory-skill/tree/main/install/codex/human-like-memory
```

安装完成后，建议重启 Codex。

## 生成可安装产物

```bash
git clone https://github.com/humanlike2026/human-like-memory-skill.git
cd human-like-memory-skill
node scripts/build-distributions.mjs
```

Codex 对应的完整目录是：

```text
dist/codex/human-like-memory
```

## 安装

把 build 后的完整目录复制到 Codex skills 目录：

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R dist/codex/human-like-memory "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory"
```

如果你使用的是默认目录，那么目标位置通常就是：

```text
~/.codex/skills/human-like-memory
```

## 配置

Codex 这里不依赖仓库自定义的配置中心，推荐直接通过环境变量注入：

```bash
export HUMAN_LIKE_MEM_API_KEY="mp_xxx"
export HUMAN_LIKE_MEM_BASE_URL="https://plugin.human-like.me"
export HUMAN_LIKE_MEM_USER_ID="default-user"
export HUMAN_LIKE_MEM_AGENT_ID="main"
export HUMAN_LIKE_MEM_SCENARIO="human-like-memory-skill"
export HUMAN_LIKE_MEM_RECALL_ENABLED="true"
export HUMAN_LIKE_MEM_ADD_ENABLED="true"
export HUMAN_LIKE_MEM_AUTO_SAVE_ENABLED="true"
export HUMAN_LIKE_MEM_SAVE_TRIGGER_TURNS="5"
export HUMAN_LIKE_MEM_LIMIT_NUMBER="6"
export HUMAN_LIKE_MEM_MIN_SCORE="0.1"
```

### 最少需要配什么

最低只需要：

- `HUMAN_LIKE_MEM_API_KEY`

但如果你想和别的客户端共享同一个记忆池，强烈建议把下面三项也显式写清楚：

- `HUMAN_LIKE_MEM_USER_ID`
- `HUMAN_LIKE_MEM_AGENT_ID`
- `HUMAN_LIKE_MEM_SCENARIO`

## 验证

先检查配置：

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" config
```

再做一个简单召回：

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" recall "我最近在推进什么项目"
```

## 常用命令

### 检查配置

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" config
```

### 搜索和召回

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" recall "上次的项目路线图"
node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" search "我的命名偏好"
```

### 保存单轮记忆

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" save \
  "我默认使用北京时间" \
  "收到，我会在后续相关场景中沿用这个偏好"
```

### 批量保存

```bash
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | \
  node "${CODEX_HOME:-$HOME/.codex}/skills/human-like-memory/scripts/memory.mjs" save-batch
```

如果输入里包含 assistant `tool_calls` 或 `tool` 结果消息，shared runtime 会默认按 procedural memory v2 协议一起写入；如需关闭，可设置 `HUMAN_LIKE_MEM_CAPTURE_TOOL_CALLS=false`。

## 与历史 OpenClaw 记忆兼容

如果你想让 Codex 读取历史 OpenClaw plugin 的记忆，请覆盖：

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```

## 使用建议

- 当用户要求“继续上次工作”“回忆之前讨论”时，优先 `recall` 或 `search`
- 当用户明确要求记住某个事实、偏好、纠正或重要决策时，优先 `save`
- 只有当一段对话已经形成长期价值时，才使用 `save-batch`
- 不要把简单寒暄或一次性问题也塞进长期记忆

## 常见问题

### 1. 我从 GitHub 直接指向 `adapters/codex` 安装，为什么不完整

因为 `adapters/codex` 只有包装层；真正要执行的 `scripts/*.mjs` 在共享 runtime 里。当前仓库对 GitHub 直接安装暴露的正确路径是：

```text
install/codex/human-like-memory
```

如果你是本地 build 再安装，则对应目录是：

```text
dist/codex/human-like-memory
```

### 2. 为什么 `config` 能跑，但 recall 没有结果

最常见原因是下面三项没和历史写入值对齐：

- `HUMAN_LIKE_MEM_USER_ID`
- `HUMAN_LIKE_MEM_AGENT_ID`
- `HUMAN_LIKE_MEM_SCENARIO`

### 3. 改完 skill 后 Codex 没有立刻生效

最稳妥的做法是重启 Codex，让新的 skill 目录重新被加载。
