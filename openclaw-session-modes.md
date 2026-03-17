# OpenClaw 三种 Session 模式

> 整理日期：2026-03-17
> 来源：OpenClaw 官方文档

## 概览

OpenClaw 支持三种 session 类型，通过 session key 格式区分：

| 模式 | Session Key 格式 | 运行时 |
|------|-----------------|--------|
| **Main** | `agent:<id>:main` | OpenClaw native |
| **Subagent** | `agent:<id>:subagent:<uuid>` | OpenClaw native |
| **ACP** | `agent:<id>:acp:<uuid>` | 外部 harness |

---

## 1. Main Session（主会话）

### 定义
- OpenClaw 的**主对话入口**
- 所有直接聊天（DM）默认归入 main session
- 群聊有独立的 session key，但概念上属于 main agent 的上下文

### 特点
- **持久性**：历史、记忆、状态持续保存
- **共享上下文**：所有 DM 共享同一个会话（可通过 `dmScope` 配置隔离）
- **默认入口**：用户发消息首先进入 main session

### 适用场景
- 日常对话和问答
- 多轮对话需要上下文连续性
- 访问 agent 的记忆、文件、工具

### 触发方式
- 直接在任意渠道发消息给 agent
- 私聊自动归入 main session

---

## 2. Subagent Session（子代理）

### 定义
- 从 main session **派生**的独立 agent 运行
- 拥有独立的 session、上下文、工具执行
- 完成后**汇报结果**回 requester

### 特点
- **隔离性**：独立 session，不污染 main 上下文
- **并行能力**：可同时运行多个 subagent
- **结果回传**：完成后自动通知 main session

### 生命周期模式

| mode | 说明 |
|------|------|
| `run` (oneshot) | 一次性执行，完成后结束 |
| `session` (persistent) | 持久会话，绑定 thread 可继续对话 |

### 适用场景
- **耗时任务**：研究、代码分析、文件处理
- **并行工作**：同时处理多个独立任务
- **上下文隔离**：避免长任务污染 main session

### 触发方式
```
/subagents spawn <agentId> <task>
```
或通过 `sessions_spawn` 工具

---

## 3. ACP Session（Agent Client Protocol）

### 定义
- **外部编码 harness** 的运行实例
- 通过 ACP 协议集成 Codex、Claude Code、Gemini CLI 等工具
- 由 ACP backend plugin（如 acpx）管理

### 特点
- **专业编码能力**：调用外部 harness 的完整功能
- **原生体验**：使用 harness 自己的工具链和生态
- **Thread 绑定**：可绑定到 Discord/Telegram thread，实现持久对话

### 生命周期模式

| mode | 说明 |
|------|------|
| `oneshot` | 一次性执行，返回结果 |
| `persistent` | 持久会话，thread 绑定，可多轮对话 |

### 适用场景
- **代码开发**：Codex、Claude Code 编程任务
- **复杂工程**：需要完整 IDE 体验的任务
- **多轮编程**：绑定 thread 进行持续开发

### 触发方式
```
/acp spawn codex --mode persistent --thread auto
```
或通过 `sessions_spawn(runtime: "acp")`

---

## 对比总结

### 功能维度

| 维度 | Main | Subagent | ACP |
|------|------|----------|-----|
| 运行时 | OpenClaw native | OpenClaw native | 外部 harness |
| 上下文隔离 | ❌ 共享 | ✅ 独立 | ✅ 独立 |
| 并行执行 | ❌ 单线程 | ✅ 支持 | ✅ 支持 |
| 结果回传 | - | ✅ 自动 | ✅ 自动 |
| Thread 绑定 | - | ✅ 可选 | ✅ 推荐 |
| 编码能力 | 基础 | 基础 | 专业 |

### 适用场景对比

| 场景 | 推荐模式 | 原因 |
|------|----------|------|
| 日常对话 | Main | 上下文连续，记忆共享 |
| 快速问答 | Main | 直接入口，无需额外配置 |
| 后台研究任务 | Subagent | 隔离上下文，并行执行 |
| 文件分析 | Subagent | 耗时操作，不阻塞 main |
| 代码开发 | ACP | 专业工具链，完整 IDE 体验 |
| 多轮编程讨论 | ACP (persistent) | Thread 绑定，持续开发 |
| 单次代码任务 | ACP (oneshot) | 执行后返回结果 |

### Session Key 示例

```
# Main session
agent:main:main                    # main agent 的主会话
agent:main:discord:123456789       # main agent 的 Discord 群聊

# Subagent session
agent:main:subagent:a1b2c3d4-...   # 派生的 subagent

# ACP session
agent:main:acp:e5f6g7h8-...        # Codex/Claude Code 会话
```

---

## 最佳实践

### 选择建议

1. **默认用 Main**：日常对话直接在 main session 进行
2. **长任务用 Subagent**：避免阻塞 main，保持响应
3. **编码用 ACP**：需要完整开发工具链时选择 ACP

### Thread 绑定

对于 Discord/Telegram，推荐：
- **Subagent**：`mode: "session"` + `thread: true` 实现持久对话
- **ACP**：`mode: "persistent"` + `thread: auto` 绑定 thread

### 资源管理

- Main session：持续运行，注意 token 消耗
- Subagent：完成任务后自动清理
- ACP：根据 mode 决定生命周期，oneshot 自动结束

---

## 相关链接

- OpenClaw Docs: https://docs.openclaw.ai
- Sub-agents: https://docs.openclaw.ai/tools/subagents
- ACP Agents: https://docs.openclaw.ai/tools/acp-agents
- Session Management: https://docs.openclaw.ai/concepts/session