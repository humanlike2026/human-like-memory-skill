# Claude Code

本指南说明如何把 HumanLike Memory 安装到 Claude Code。

## 一个重要前提

Claude Code 识别的是完整 skill 目录，而不是源码仓库里的某个 adapter 片段。

这个仓库现在给 Claude Code 提供两种正确的安装目标：

- GitHub 直接安装路径：`install/claude-code/human-like-memory`
- 本地 build 产物：`dist/claude-code/human-like-memory`

不建议直接把 `adapters/claude-code/` 当成最终安装目录，因为它只包含包装层，不包含完整的 `scripts/` 和共享文档。

## 从 GitHub 直接安装

如果你不想先 clone 仓库再本地 build，可以直接从 GitHub 下载已提交的完整安装目录：

```bash
tmp_dir="$(mktemp -d)" && \
curl -L https://github.com/humanlike2026/human-like-memory-skill/archive/refs/heads/main.tar.gz | tar -xz -C "$tmp_dir" && \
mkdir -p "$HOME/.claude/skills" && \
rm -rf "$HOME/.claude/skills/human-like-memory" && \
cp -R "$tmp_dir/human-like-memory-skill-main/install/claude-code/human-like-memory" "$HOME/.claude/skills/human-like-memory" && \
rm -rf "$tmp_dir"
```

安装完成后，建议重启 Claude Code。

## 生成可安装产物

```bash
git clone https://github.com/humanlike2026/human-like-memory-skill.git
cd human-like-memory-skill
node scripts/build-distributions.mjs
```

Claude Code 对应的完整目录是：

```text
dist/claude-code/human-like-memory
```

## 安装

把完整目录复制到 Claude Code 的个人 skill 目录：

```bash
mkdir -p "$HOME/.claude/skills"
cp -R dist/claude-code/human-like-memory "$HOME/.claude/skills/human-like-memory"
```

安装完成后，Claude Code 会把它识别为一个名为：

```text
/human-like-memory
```

的 skill。

## 配置

Claude Code 这里推荐通过环境变量注入 HumanLike Memory 配置：

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

### 最低配置

至少要有：

- `HUMAN_LIKE_MEM_API_KEY`

如果你希望 Claude Code 和其他客户端共享记忆池，再额外显式设置：

- `HUMAN_LIKE_MEM_USER_ID`
- `HUMAN_LIKE_MEM_AGENT_ID`
- `HUMAN_LIKE_MEM_SCENARIO`

## 验证

先检查配置：

```bash
node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" config
```

再做一个简单召回：

```bash
node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" recall "我最近在推进什么项目"
```

如果 Claude Code 已经在运行，最稳妥的做法是重启一下 Claude Code，让新的 skill 目录和环境变量都被完整加载。

## 常用命令

### 检查配置

```bash
node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" config
```

### 搜索和召回

```bash
node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" recall "上次讨论过的路线图"
node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" search "我提过什么偏好"
```

### 保存单轮结论

```bash
node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" save \
  "我默认使用北京时间" \
  "收到，我会在相关场景里记住这个偏好"
```

### 批量保存多轮对话

```bash
echo '[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]' | \
  node "$HOME/.claude/skills/human-like-memory/scripts/memory.mjs" save-batch
```

如果输入里包含 assistant `tool_calls` 或 `tool` 结果消息，shared runtime 会默认按 procedural memory v2 协议一起写入；如需关闭，可设置 `HUMAN_LIKE_MEM_CAPTURE_TOOL_CALLS=false`。

## 与历史 OpenClaw 记忆兼容

如果你想让 Claude Code 读取或继续写入历史 OpenClaw plugin 的记忆，请改成：

```bash
export HUMAN_LIKE_MEM_SCENARIO="openclaw-plugin"
export HUMAN_LIKE_MEM_AGENT_ID="main"
```

## 使用建议

- 当用户让 Claude Code 延续上一次工作时，优先 `recall`
- 当用户要求查找以前提过的主题或偏好时，优先 `search`
- 当用户明确说“记住这个”或确认了稳定偏好、纠正、重要决策时，优先 `save`
- 只有多轮对话确实沉淀出长期价值时，才使用 `save-batch`

## 常见问题

### 1. 为什么我不能直接从源码仓库里的 `adapters/claude-code` 安装

因为那只是包装层，不是完整 skill。GitHub 直接安装应该使用：

```text
install/claude-code/human-like-memory
```

如果你是本地 build 再安装，则真正需要安装的是：

```text
dist/claude-code/human-like-memory
```

### 2. skill 已经复制到了 `~/.claude/skills`，但 Claude Code 还没识别

通常是因为 Claude Code 在 skill 目录创建之前已经启动。重启一下最稳。

### 3. 能正常调用，但查不到旧记忆

优先检查这三项是否与历史写入一致：

- `HUMAN_LIKE_MEM_USER_ID`
- `HUMAN_LIKE_MEM_AGENT_ID`
- `HUMAN_LIKE_MEM_SCENARIO`
