# Core Runtime

`core/` 是这个仓库真正的共享运行时层。

无论最终安装到 OpenClaw、Hermes、Codex 还是 Claude Code，只要调用的是 HumanLike Memory，本质上跑的都是这里的脚本。

也正因为如此，`core/` 才是这个仓库真正的 source of truth。

## `core/` 负责什么

它统一处理：

- 环境变量和 CLI flags 的解析
- API Key 认证与 HTTP 请求发送
- `recall` / `search` / `save` / `save-batch` / `config`
- 共享的查询归一化和返回格式
- 所有平台共用的配置协议和安全边界

## 文件说明

- `scripts/config.mjs`
  负责把 `HUMAN_LIKE_MEM_*` 变量和 CLI 参数归一化成最终运行配置。
- `scripts/client.mjs`
  负责对 HumanLike Memory 服务的 HTTP 调用。
- `scripts/memory.mjs`
  共享 CLI 入口，所有平台最终都通过它执行业务动作。
- `docs/shared-config.md`
  定义所有平台共用的配置契约。
- `docs/security-model.md`
  定义这个共享 runtime 的联网行为和安全边界。

## 为什么要把 `core/` 抽出来

如果没有 `core/` 这一层，那么每个平台都要各自维护一套：

- 参数解析
- HTTP 调用
- 召回和保存协议
- 错误处理
- 返回格式

这会导致一件事一旦修了 bug，就要回填多次，而且很容易出现平台之间行为不一致。

现在的结构是：

- 共享能力统一进 `core/`
- 平台差异只放进 `adapters/`
- 宿主专属深度接线放进 `integrations/`

这样改动会更稳，也更容易验证。

## 默认兼容值

当前共享 runtime 的默认值是：

- `HUMAN_LIKE_MEM_BASE_URL=https://plugin.human-like.me`
- `HUMAN_LIKE_MEM_USER_ID=default-user`
- `HUMAN_LIKE_MEM_AGENT_ID=main`
- `HUMAN_LIKE_MEM_SCENARIO=human-like-memory-skill`

这套默认值强调“平台中立”，不再把某一个历史宿主平台当作默认命名空间。

## 如果要兼容历史 OpenClaw 记忆

如果你需要复用历史 OpenClaw plugin 写入的记忆，请显式切回：

- `HUMAN_LIKE_MEM_SCENARIO=openclaw-plugin`
- `HUMAN_LIKE_MEM_AGENT_ID=main`

只要 `user_id / agent_id / scenario` 三者不一致，检索就可能打不到同一个记忆池。

## `core/` 不是最终安装目标

最终用户不应该直接安装 `core/`。

原因很简单：

- `core/` 不包含平台的 `SKILL.md`
- `core/` 不包含 OpenClaw 的 `skill.json`
- `core/` 不包含 Hermes 的 provider helper
- `core/` 也不包含各平台各自的 README 和安装说明

最终安装目录由：

```bash
node scripts/build-distributions.mjs
```

组装生成到 `dist/` 下。

## 推荐理解方式

你可以把整个仓库理解成这样：

- `core/` = 引擎
- `adapters/` = 各平台的接线壳
- `integrations/` = 个别平台的原生深度接法
- `dist/` = 给最终用户安装的完整包
