# OpenClaw 功能总览

> 本文档由 Outis 生成，旨在提供 OpenClaw 的完整功能概览。
> 
> 生成日期：2026-03-09
> 
> 适用版本：OpenClaw v2026.x

---

## 核心定位

**自托管的 AI Agent 网关** — 一条命令在你的机器上跑起来，连接各种聊天应用和 AI agent。

---

## 1. 多渠道接入

一条 Gateway 进程同时服务：

| 渠道 | 说明 |
|------|------|
| WhatsApp | via WhatsApp Web (Baileys) |
| Telegram | Bot (grammY) |
| Discord | Bot (discord.js) |
| iMessage | 本地 imsg CLI (macOS only) |
| 插件扩展 | Mattermost 等 |

**多账号支持**：同一渠道可配置多个账号（如两个 WhatsApp 号码），每个账号可路由到不同 agent。

---

## 2. 多智能体路由 (Multi-Agent)

多个独立"大脑"共存，每个 agent 拥有：

- **独立 workspace** — 文件、记忆、人格设定 (SOUL.md, AGENTS.md, USER.md)
- **独立 auth profiles** — 认证信息不共享
- **独立 session store** — 聊天历史隔离

**路由规则**：通过 bindings 配置，可实现：
- 不同频道 → 不同 agent
- 不同群组/私聊 → 不同 agent
- 不同发送者 → 不同 agent

---

## 3. 节点系统 (Nodes)

远程设备控制，扩展 agent 的感知和执行能力：

### 移动端节点 (iOS/Android)
- 相机拍照/录像
- 屏幕录制
- 位置获取
- 通知读取
- 通讯录/日历访问
- 短信发送 (Android)

### macOS 节点
- 本地 shell 执行
- 系统通知

### 无头节点 (Headless)
- Linux/Windows 远程命令执行

---

## 4. 自动化 (Automation)

| 功能 | 说明 |
|------|------|
| Cron 定时任务 | 定时提醒、周期执行 |
| Webhook | 外部事件触发 agent |
| Hooks | 消息进出时的钩子处理 |
| Heartbeat | 定期主动检查（邮件、日程等） |

**Cron vs Heartbeat**：
- Cron：精确时间触发，独立执行
- Heartbeat：轮询式检查，可聚合多个任务

---

## 5. 会话与记忆

| 特性 | 说明 |
|------|------|
| 会话隔离 | 私聊归入 main session，群聊独立 |
| 记忆系统 | MEMORY.md (长期) + 每日笔记 |
| 会话修剪 | 自动压缩/清理历史上下文 |

---

## 6. 媒体与交互

- 收发图片、音频、文档
- 语音转文字 hook（可选配置）
- 流式输出：长消息分块发送
- 打字指示器：显示"正在输入"状态
- Markdown 渲染（按平台适配）

---

## 7. 安全与控制

| 特性 | 说明 |
|------|------|
| Token/密码认证 | Gateway 访问控制 |
| Allowlist | 只允许特定发送者 |
| 沙箱模式 | 限制 agent 的文件/命令访问 |
| 工具权限 | 允许/禁止特定工具 (read, write, exec 等) |
| DM Policy | pairing / allowlist / open |

---

## 8. 管理 UI

- **Web Control UI**：浏览器管理（chat、config、sessions、nodes）
- **CLI**：完整命令行控制

---

## 架构图

```
┌─────────────────────────────────────┐
│  聊天应用 (WhatsApp/Telegram/etc.)   │
└─────────────────┬───────────────────┘
                  │
                  ▼
           ┌──────────┐
           │ Gateway  │◄── Web UI / CLI / Cron / Webhook
           └────┬─────┘
                │
                ▼
           ┌──────────┐
           │  Agent   │◄── 记忆 / 工具 / 沙箱
           └────┬─────┘
                │
                ▼
           ┌──────────┐
           │ LLM API  │
           └──────────┘
```

---

## 一句话总结

**OpenClaw 让你用自己的设备、自己的数据，搭一个多渠道、多智能体的 AI 助手中枢。**

---

## 相关链接

- 官方文档：https://docs.openclaw.ai
- GitHub：https://github.com/openclaw/openclaw
- 社区：https://discord.com/invite/clawd
- 技能市场：https://clawhub.com