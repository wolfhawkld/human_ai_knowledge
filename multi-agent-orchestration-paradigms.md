# 多 Agent 协作范式对比分析

> 比较四种主流多 Agent 编排范式：Claude Code Dynamic Workflows、Claude Code Agent Teams、OpenClaw Subagents、OpenClaw ACP

> 最后更新：2026-06-16 | 作者：Outis

---

## 概述

随着 AI Agent 框架的快速发展，多 Agent 协作已成为从研究到工程化的核心议题。本文对比四种具有代表性的多 Agent 编排范式，分析其架构差异、适用场景和演进趋势。

---

## 四种范式速览

### 1. Claude Code Dynamic Workflows（2026.05.28 发布）

**核心思想**：*"The plan lives in code, not context."*

Claude 接到任务后，动态生成一段 JavaScript 编排脚本，runtime 按脚本并行执行子 agent。编排逻辑消耗零模型 token，子 agent 全隔离。

- 最高 16 并发，单次运行上限 1000 个子 agent
- 通过 prompt 中包含 "workflow" 或 `/effort ultracode` 触发
- 内置 `deep-research` 等 bundled workflow
- 支持 adversarial review（子 agent 互相校验输出）

### 2. Claude Code Agent Teams（2026.02.05 发布）

**核心思想**：*"The lead agent supervises peers who talk to each other."*

一个 Team Lead agent 分解任务，spawn 同级 peer agent，peer 之间通过 mailbox 系统通信，通过 Git 写锁避免冲突。

- 规模偏小（几个 peer）
- Peer-to-peer 直接通信
- 依赖 Opus 4.6+，实验性特性

### 3. OpenClaw Subagents

**核心思想**：*"The parent spawns a child, the child reports back."*

通过 `session_spawn` 工具，当前 agent 创建子 session 分配任务，子 agent 完成后返回结果。父子结构。

- 每轮可 spawn 几个子 agent
- 可选 fork 上下文（继承或不继承父 context）
- 简单稳定，适合结构化分解的任务

### 4. OpenClaw ACP（Agent Communication Protocol）

**核心思想**：*"Standardized interop layer between any agent and any harness."*

开放协议标准，让不同框架的 AI agent 之间互相发现、通信、协作——类似于 agent 界的 HTTP 协议。

- 跨框架互操作（OpenClaw ↔ Claude Code ↔ Codex ↔ Gemini CLI）
- 走 WebSocket/stdio 通道
- 无内置编排逻辑，完全由上层框架决定
- 与 DeepLearning.AI 推出的 ACP 标准兼容

---

## 核心维度对比

| 维度 | Dynamic Workflows | Agent Teams | OpenClaw Subagents | OpenClaw ACP |
|:---|:---|:---|:---|:---|
| **编排由谁决定** | 脚本（JS 代码） | Team Lead（逐轮决策） | 父 agent（逐轮决策） | 协议层，无内置编排 |
| **下一步谁说了算** | 脚本的循环/分支 | Lead agent，turn by turn | 父 agent，turn by turn | 框架层控制 |
| **中间结果在哪** | 脚本变量 | 共享任务列表 | 父 agent 的 context | 看实现 |
| **可复用的是什么** | 编排脚本本身 | 团队定义 | worker 定义 | 协议标准 |
| **规模** | 几十~1000 | 几个 peer | 每轮几个 | 无上限（协议层） |
| **通信模型** | 脚本→子 agent（单向） | Peer-to-peer mailbox | 父子（树状） | 标准化的 agent ↔ agent |
| **是否可恢复** | ✅ 同 session 可恢复 | ✅ 队友独立运行 | ❌ 中断后重来 | 看实现 |
| **跨框架** | ❌ Claude 独占 | ❌ Claude 独占 | ❌ OpenClaw 内部 | ✅ 任何 ACP 框架 |

---

## 关键架构差异

### 编排决策的位置

这是 Dynamic Workflows 相比其他范式最本质的区别：

```
传统范式（Agent Teams / OpenClaw Subagents）:
  模型 token → 上下文 → 决策逻辑
              ↑         ← 每步消耗 token，撑爆 context

Dynamic Workflows:
  [Claude 生成脚本 ↓] ← 消耗一次模型调用
  [脚本执行] ← 零 token 消耗，纯 CPU 循环
    ├── spawn agent 1 → 结果集
    ├── spawn agent 2 → 结果集
    └── loop + validate + cross-check
```

**核心洞察**：编排的成本从 O(n) token 降至 O(1)——只消耗一次模型调用来生成脚本，剩下的全是编排 runtime 执行。这意味着 500 个子 agent 的编排成本跟 5 个一样。

### 通信拓扑

```
Agent Teams:    A ←→ B
                ↕    ↕
                C ←→ D    （网状 peer-to-peer）

Subagents:      Parent
                ├── Child A
                ├── Child B
                └── Child C    （树状父子）

Dynamic Workflows:
                Script (JS runtime)
                ├── agent 1
                ├── agent 2
                └── wait + collect    （星状→脚本收敛）

ACP:            Agent A ↔ Agent B ↔ Agent C
                （无固定拓扑，完全看上层实现）
```

### 协作的自适应性

| 范式 | 适应性 | 速度 | 原因 |
|:---|:---|:---|:---|
| Agent Teams | ⭐⭐⭐ 高 | ⭐⭐ 中 | Lead 动态决策，但每步消耗 token |
| Dynamic Workflows | ⭐⭐ 中 | ⭐⭐⭐⭐⭐ 快 | 脚本固定，但编排不耗 token |
| OpenClaw Subagents | ⭐⭐⭐⭐ 最高 | ⭐ 慢 | 父 agent 最灵活，但 turn by turn 最贵 |
| ACP | 不适用 | 不适用 | 协议层不做编排决策 |

---

## 最佳实践场景

| 范式 | 适合 | 不适合 |
|:---|:---|:---|
| **Dynamic Workflows** | 大规模并行搜索、代码审计、全量迁移、交叉验证研究 | 需动态调整方向的探索性任务 |
| **Agent Teams** | 需 peer 持续对话的协同开发（前后端、测试） | 超大规模或一次性并行 |
| **OpenClub Subagents** | 结构化日常任务、小规模并行、研究实验 | peer 间通信或超大规模 |
| **ACP** | 异构框架互操作、OpenClaw 调用外部 harness | 单框架内部简单协作（太重） |

---

## 演进趋势

```
只卷效果 → 开始卷架构
  ↓
单 agent 线性执行
  ↓
父子 subagent（OpenClaw 方式）→ 简单可靠，适合日常
  ↓
Peer-to-peer 团队（Agent Teams）→ 适中小团队协作
  ↓
脚本编排大规模并行（Dynamic Workflows）→ 企业级规模化
  ↓
跨框架标准协议（ACP）→ 异构生态互连
```

**关键洞察**：Dynamic Workflows 最重要的创新不是"1000 个 agent"，而是 **"orchestration as code"** 模式。将协调逻辑从模型上下文移至可版本控制的脚本，这对企业工程化至关重要：

- ✅ 可审计：脚本是明文 JS，非黑盒
- ✅ 可 rerun：同样的脚本重跑，结果一致
- ✅ 可集成 CI/CD：脚本可纳入部署流水线
- ✅ 成本可预测：编排开销固定，token 消耗仅有子 agent 的执行部分

---

## 参考来源

- [Claude Code Dynamic Workflows 官方文档](https://code.claude.com/docs/en/workflows)
- [Claude Code Agent Teams 官方文档](https://code.claude.com/docs/en/agent-teams)
- [OpenClaw Subagents 文档](https://docs.openclaw.ai)
- [OpenClaw ACP 协议规范](https://eaveluo.com/en/docs/ai/openclaw/acp-agent-protocol)
- [OpenClaw Agent Runtimes 概念文档](https://docs.openclaw.ai/concepts/agent-runtimes)
