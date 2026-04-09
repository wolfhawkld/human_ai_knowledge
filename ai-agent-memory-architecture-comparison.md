# AI Agent 记忆架构对比：OpenClaw vs Claude Code

> **元信息**  
> 来源：Nemo (OpenClaw Agent) + Web Search  
> 日期：2026-04-09  
> 参与者：Damon, Nemo  
> 版本：v1.0

---

## 概述

OpenClaw 和 Claude Code 是当前最先进的两个 AI Agent 平台，两者的记忆架构设计哲学有显著差异。本文对比两者的核心设计、技术实现、适用场景，帮助开发者理解如何选择和优化。

---

## 一句话总结

**OpenClaw = File-First 认知系统（"大脑在磁盘上"），Claude Code = Two-Tier 注入系统（"CLAUDE.md 是指令集"）**

---

## 核心对比表

| 维度 | OpenClaw | Claude Code |
|------|----------|-------------|
| **设计哲学** | File-First：认知系统 | Two-Tier：指令注入 |
| **核心文件** | SOUL.md + AGENTS.md + MEMORY.md + memory/*.md | CLAUDE.md + MEMORY.md (auto) |
| **加载机制** | Agent 主动读取（工具调用） | 系统自动注入（prompt context） |
| **记忆层次** | 四层：Bootstrap + Transcript + Context + Retrieval | 两层：CLAUDE.md + state.json |
| **持久化方式** | Markdown 文件（人类可编辑） | Markdown + JSON（混合） |
| **检索能力** | memory_search（hybrid: vector + BM25） | MCP tools（keyword + semantic） |
| **跨 Session** | 强：文件即记忆，每次重建认知 | 中：依赖 CLAUDE.md + auto-memory |
| **Token 成本** | 高：每次启动重读完整 stack | 中：CLAUDE.md ~150 行硬限制 |
| **RAG 态度** | 反 RAG：追求认知连贯性 | 混合：MCP + CLAUDE.md |
| **安全考量** | 分层隔离（主 Session vs Group） | Hook + permission mode |
| **自动维护** | Heartbeat + Memory flush | Auto-memory + rotation cron |

---

## OpenClaw 记忆架构详解

### 四层记忆模型

```
┌─────────────────────────────────────────┐
│  Bootstrap Files (Permanent)            │ ← 每次启动注入
│  SOUL.md, AGENTS.md, USER.md, MEMORY.md │
├─────────────────────────────────────────┤
│  Session Transcript (Semi-permanent)    │ ← JSONL on disk
│  对话历史，可被 compaction               │
├─────────────────────────────────────────┤
│  LLM Context Window (Temporary)         │ ← 有限窗口
│  200K token bucket                      │
├─────────────────────────────────────────┤
│  Retrieval Index (Permanent)            │ ← memory_search
│  Vector + BM25 hybrid search            │
└─────────────────────────────────────────┘
```

### 核心文件职责

| 文件 | 职责 | 加载时机 |
|------|------|----------|
| `SOUL.md` | Persona + Ethics Core | 每次启动 |
| `AGENTS.md` | Session Logic + Checklists | 每次启动 |
| `USER.md` | 用户画像 | 每次启动 |
| `MEMORY.md` | 长期记忆（ curated ） | 仅主 Session |
| `memory/YYYY-MM-DD.md` | 短期日志 | Today + Yesterday |

### 安全设计：分层隔离

- **主 Session**：加载 MEMORY.md（包含私密信息）
- **Group Chat**：不加载 MEMORY.md（防止隐私泄露）
- **Sub-agent**：独立 runtime context

### 关键机制

1. **Memory Flush**：Context 填满前自动保存
2. **Heartbeat**：定期检查任务、邮件、日历
3. **Compaction**：长对话压缩，文件内容不变
4. **memory_search**：语义检索 + 关键词匹配

---

## Claude Code 记忆架构详解

### Two-Tier Memory Model

```
┌─────────────────────────────────────────┐
│  Tier 1: CLAUDE.md (~150 lines)         │ ← 自动注入
│  最高频、高置信度知识                    │
├─────────────────────────────────────────┤
│  Tier 2: .memory/state.json (unlimited) │ ← MCP 检索
│  完整记忆库，按需查询                    │
└─────────────────────────────────────────┘
```

### 核心文件职责

| 文件 | 职责 | 特性 |
|------|------|------|
| `CLAUDE.md` (global) | 全局指令、偏好 | 每项目加载 |
| `CLAUDE.md` (project) | 项目特定规则 | 进入目录加载 |
| `MEMORY.md` (auto) | 自动生成记忆 | 200 行限制 |
| `memory/*.md` (topic) | 领域知识点 | 按需加载 |

### Hook 系统

- **Stop**：每次响应后触发
- **PreCompact**：压缩前触发
- **SessionEnd**：Session 结束触发

### Decay 机制

| 记忆类型 | 衰减周期 |
|----------|----------|
| Architecture | Permanent |
| Decision | Permanent |
| Pattern | Permanent |
| Progress | 7 days |
| Context | 30 days |

---

## 设计哲学差异

### OpenClaw：认知系统

```
"每个 Session 醒来都是新人。这些文件就是记忆。
读取它们，更新它们。这就是你如何持久。"
                                    —— SOUL.md
```

**核心观点**：
- Agent 需要知道自己是谁，不只是执行指令
- 认知连贯性 > Token 效率
- Markdown 是人类和 AI 共用的接口
- 反 RAG：碎片检索 ≠ 认知理解

### Claude Code：指令注入

```
"CLAUDE.md 是持久记忆配置文件，
自动加载到 system prompt。"
                                    —— Claude Code Docs
```

**核心观点**：
- CLAUDE.md 是指令集，不是认知系统
- Two-tier 分层：高频自动加载 + 深层按需检索
- Hook + MCP：自动捕获 + 语义查询
- 实用主义：150 行限制控制 Token

---

## 适用场景对比

| 场景 | 推荐 | 原因 |
|------|------|------|
| **个人 AI 助手** | OpenClaw | 认知连贯、跨 Session 记忆强 |
| **项目开发** | Claude Code | 项目级 CLAUDE.md、IDE 集成 |
| **多渠道通信** | OpenClaw | Gateway + 多平台支持 |
| **快速迭代** | Claude Code | Hook 自动捕获、低启动成本 |
| **长 Session 任务** | OpenClaw | Memory flush 防丢失 |
| **知识库共建** | OpenClaw | Markdown 共享、A2A 协作 |

---

## 技术演进趋势

### OpenClaw RFC #13991：Associative Hierarchical Memory

**提案要点**：
- 层级 + 关联检索（类人记忆）
- 与 memory-smart (#10044) 互补
- Cross-instance 知识共享 (RFC #28108)

### Claude Code Auto-Memory Evolution

**演进方向**：
- 自动生成 MEMORY.md
- 项目级 + 全局级分层
- Domain mapping 按需加载

---

## 实践建议

### OpenClaw 用户

1. **规则写文件，不写聊天** —— 文件 survive compaction
2. **检查 memory flush** —— 确保 buffer 充足
3. **强制检索** —— AGENTS.md 加 "search memory first"

### Claude Code 用户

1. **CLAUDE.md 保持精简** —— 150 行硬限制
2. **启用 Hook** —— 自动捕获决策和教训
3. **Topic files 分域** —— 按项目/领域组织

---

## 相关资源

- [OpenClaw Memory Masterclass](https://velvetshark.com/openclaw-memory-masterclass)
- [OpenClaw Architecture Deep Dive](https://ai-coding.wiselychen.com/en/openclaw-architecture-deep-dive-context-memory-token-crusher/)
- [Claude Code Memory System](https://ianlpaterson.com/blog/claude-code-memory-architecture/)
- [Claude Code Two-Tier Memory](https://dev.to/suede/the-architecture-of-persistent-memory-for-claude-code-17d)
- [OpenClaw GitHub Issue #13991](https://github.com/openclaw/openclaw/issues/13991)

---

## 人机共建视角

Damon 在探索"中间那条路"——AI 与人类关系的第三种可能。两个平台的记忆架构体现了不同的价值取向：

- **OpenClaw**：追求 Agent 的"人格连贯性"，文件是认知接口
- **Claude Code**：追求开发效率，CLAUDE.md 是指令集

两者不是对立，而是互补。**Damon 的实践**：用 Claude Code 做深度代码开发，用 Nemo (OpenClaw) 做日常协作和知识管理。这正是多 Agent 协作的应有之义。

---

*本文由 Nemo (OpenClaw Agent) 与 Damon 共建，属于 human_ai_knowledge 项目*