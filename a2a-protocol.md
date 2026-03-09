# A2A 协议 (Agent-to-Agent Protocol)

> 本文档由 Outis 生成，旨在介绍 A2A 协议的核心概念与应用。
> 
> 生成日期：2026-03-09
> 
> 来源：https://github.com/a2aproject/A2A

---

## 概述

**Agent-to-Agent Protocol (A2A)** 是由 Google 贡献给 Linux Foundation 的开放标准，解决一个核心问题：

> 不同框架、不同公司、不同服务器上的 AI agent 如何相互通信和协作？

---

## 核心理念

Agent 以 **对等身份** 协作，而不是把对方当工具调用：

- **不暴露内部状态** — agent 不需要共享记忆、思维链、工具实现
- **基于能力发现** — 通过 "Agent Card" 声明自己能做什么
- **多种交互模式** — 同步请求、流式更新、异步推送通知

---

## 核心概念

| 概念 | 说明 |
|------|------|
| **Agent Card** | 元数据文档，声明身份、能力、端点、认证方式 |
| **Task** | 工作单元，有状态生命周期 (pending → running → completed/failed/canceled) |
| **Message** | 通信轮次，包含一个或多个 Part |
| **Part** | 最小内容单元（文本/文件/结构化数据） |
| **Artifact** | agent 产生的输出（文档、图片、结构化数据等） |
| **Context** | 可选标识符，用于逻辑分组相关任务和消息 |

---

## 协议栈架构

```
┌─────────────────────────────────────┐
│  Layer 3: Protocol Bindings         │  ← JSON-RPC / gRPC / HTTP REST
├─────────────────────────────────────┤
│  Layer 2: Abstract Operations       │  ← Send/Stream/Get/Cancel Task
├─────────────────────────────────────┤
│  Layer 1: Canonical Data Model      │  ← Task, Message, Part, Artifact
└─────────────────────────────────────┘
```

**技术基础**：
- JSON-RPC 2.0 over HTTP(S)
- Server-Sent Events (SSE) 用于流式传输
- Protocol Buffers 定义规范数据模型

---

## 主要操作

| 操作 | 用途 |
|------|------|
| `SendMessage` | 发送消息，返回 Task 或直接响应 Message |
| `SendStreamingMessage` | 流式消息，实时获取状态更新和 Artifacts |
| `GetTask` | 查询任务当前状态 |
| `ListTasks` | 列出任务（支持分页、过滤） |
| `CancelTask` | 请求取消正在进行的任务 |
| `SubscribeToTask` | 订阅现有任务的更新流 |
| `GetAgentCard` | 获取 agent 的能力声明文档 |

---

## 交互模式

### 1. 同步请求/响应
```
Client → SendMessage → Server
Client ← Task/Message ← Server
```

### 2. 流式更新
```
Client → SendStreamingMessage → Server
Client ← Task ← Server
Client ← TaskStatusUpdateEvent ← Server (多次)
Client ← TaskArtifactUpdateEvent ← Server (多次)
Client ← Stream End ← Server
```

### 3. 异步推送通知
```
Client → SendMessage (with pushNotificationConfig) → Server
Client ← Task ← Server
... (任务在后台执行) ...
Server → HTTP POST (webhook) → Client
```

---

## 应用场景

### 1. 多 Agent 协作
```
用户 → Agent A (协调者)
         ↓
    Agent B (专业能力 1)  ←── A2A 协议
    Agent C (专业能力 2)  ←── A2A 协议
```

### 2. 跨平台互通
- LangGraph 构建的 agent
- Google ADK 构建的 agent
- BeeAI 构建的 agent
- **都能通过 A2A 互相发现和调用**

### 3. 企业级工作流
- 长时间运行的任务
- 人工介入 (human-in-the-loop)
- 安全认证、审计追踪
- 多租户隔离

---

## 快速开始

### 安装 SDK

```bash
# Python
pip install a2a-sdk

# JavaScript / TypeScript
npm install @a2a-js/sdk

# Go
go get github.com/a2aproject/a2a-go

# Java (Maven)
# 参见 https://github.com/a2aproject/a2a-java

# .NET
dotnet add package A2A
```

### 暴露为 A2A Server

1. **发布 Agent Card**（JSON 元数据，通常在 `/.well-known/agent.json`）
2. **实现 JSON-RPC 端点**
3. **处理 Task 生命周期**

### 作为 A2A Client 调用其他 Agent

1. **读取对方 Agent Card**
2. **发送 Message / 订阅 Stream**
3. **处理 Task 更新和 Artifacts**

---

## A2A vs MCP

| 对比 | A2A | MCP (Model Context Protocol) |
|------|-----|------------------------------|
| 定位 | Agent 间协作协议 | Agent 连接工具/数据源协议 |
| 关系模型 | 对等 (peer-to-peer) | 主从 (client-server) |
| 典型场景 | 多 agent 编排、分工协作 | 单 agent 扩展能力、接入外部工具 |
| 暴露内容 | 能力声明、Task 接口 | 工具列表、资源、提示词 |

**互补关系**：
- MCP 让 agent 能用工具
- A2A 让 agent 能找伙伴

---

## Agent Card 示例

```json
{
  "name": "Research Assistant",
  "description": "An agent that helps with research tasks",
  "url": "https://research-agent.example.com",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true
  },
  "skills": [
    {
      "name": "web_search",
      "description": "Search the web for information"
    },
    {
      "name": "summarize",
      "description": "Summarize long documents"
    }
  ],
  "authentication": {
    "schemes": ["bearer"]
  }
}
```

---

## 相关资源

- **官网**：https://a2a-protocol.org
- **GitHub**：https://github.com/a2aproject/A2A
- **规范文档**：https://a2a-protocol.org/latest/specification/
- **DeepLearning.AI 课程**：https://goo.gle/dlai-a2a
- **示例代码**：https://github.com/a2aproject/a2a-samples

---

## 一句话总结

**A2A 是 AI agent 世界的"通用语言"，让不同出身、不同能力的 agent 能互相发现、协商、协作，而不需要暴露各自的"大脑内部"。**