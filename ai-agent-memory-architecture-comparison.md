# AI Agent 记忆架构对比：OpenClaw vs Claude Code

> **元信息**  
> 来源：Nemo (OpenClaw Agent) + Web Search + Claude Code 源码泄露分析  
> 日期：2026-04-09  
> 参与者：Damon, Nemo  
> 版本：v2.0（重大更新：加入 Dreaming + KAIROS 特性）

---

## 概述

OpenClaw 和 Claude Code 是当前最先进的两个 AI Agent 平台。根据 **2026年4月最新信息**（包括 Claude Code 512,000 行源码泄露），两者的记忆架构设计有了重大演进：

- **OpenClaw v2026.4.5+**：新增 **Dreaming（梦境）** 三阶段后台记忆整合系统
- **Claude Code 源码泄露**：揭示 **四层记忆架构** + 未发布的 **KAIROS/Chyros Daemon** 后台模式

---

## 一句话总结

**OpenClaw = File-First 认知系统 + 梦境整合（"睡一觉更聪明"）**  
**Claude Code = 四层记忆 + KAIROS Daemon（"你睡觉它修 bug"）**

---

## 核心对比表（2026.04 最新版）

| 维度 | OpenClaw | Claude Code |
|------|----------|-------------|
| **设计哲学** | File-First 认知系统 + 仿生睡眠 | 四层记忆 + Daemon 后台 |
| **记忆层次** | **五层**：Bootstrap + Transcript + Context + Retrieval + **Dreaming** | **四层**：CLAUDE.md + Auto Memory + Auto Dream + **KAIROS** |
| **后台整合** | **Dreaming**（Light → REM → Deep） | **Auto Dream** + KAIROS Daemon |
| **核心文件** | SOUL.md + AGENTS.md + MEMORY.md + memory/*.md + **DREAMS.md** | CLAUDE.md + MEMORY.md + topic files |
| **加载机制** | Agent 主动读取 + Dreaming 后台整理 | 系统注入 + 200 行硬限制 |
| **持久化方式** | Markdown 文件（人类可编辑） | Markdown + JSON（混合） |
| **检索能力** | memory_search（hybrid: vector + BM25） | **Grep-only**（无语义检索） |
| **跨 Session** | 强：文件即记忆 + Dreaming 升级 | 中：依赖 Auto Memory |
| **跨 Agent** | **A2A 协议**（多实例共享） | ❌ 无跨 Agent 共享 |
| **后台进程** | Dreaming cron（凌晨 3 点） | **KAIROS Daemon**（未发布） |
| **安全考量** | 分层隔离（主 Session vs Group） | Feature flag + scope 限制 |
| **最新版本** | v2026.4.9（REM backfill + diary UI） | 2.1.88（源码泄露版） |

---

## OpenClaw 记忆架构详解（2026 最新）

### 五层记忆模型

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
├─────────────────────────────────────────┤
│  Dreaming System (后台整合)              │ ← v2026.4.5+ 新增
│  Light → REM → Deep 三阶段               │
└─────────────────────────────────────────┘
```

### 🆕 Dreaming（梦境）系统详解

**核心设计**：模拟人类睡眠周期，后台整合短期记忆 → 长期记忆

#### 三阶段睡眠模型

| 阶段 | 职责 | 写入 MEMORY.md |
|------|------|----------------|
| **Light Sleep（浅睡）** | 摄入短期记忆信号，去重，暂存候选 | ❌ 否 |
| **REM Sleep（REM）** | 模式识别、主题反思、跨日关联 | ❌ 否 |
| **Deep Sleep（深睡）** | 评分、阈值判断、升级到长期记忆 | ✅ 唯一写入 |

#### Deep Phase 六大评分信号

| 信号 | 权重 | 说明 |
|------|------|------|
| Relevance | 0.30 | 平均检索质量 |
| Frequency | 0.24 | 短期信号累积次数 |
| Query diversity | 0.15 | 不同 query/day 上下文数 |
| Recency | 0.15 | 时间衰减新鲜度 |
| Consolidation | 0.10 | 多日复现强度 |
| Conceptual richness | 0.06 | 概念标签密度 |

#### 关键配置

```json
{
  "plugins": {
    "entries": {
      "memory-core": {
        "config": {
          "dreaming": {
            "enabled": true,
            "frequency": "0 3 * * *",  // 凌晨 3 点
            "phases": {
              "deep": {
                "minScore": 0.8,
                "minRecallCount": 2,
                "minUniqueQueries": 2
              }
            }
          }
        }
      }
    }
  }
}
```

#### 输出文件

| 文件 | 内容 |
|------|------|
| `MEMORY.md` | 唯一的长期记忆存储 |
| `DREAMS.md` | Dream Diary（人类可读日志） |
| `memory/dreaming/<phase>/YYYY-MM-DD.md` | 各阶段报告 |
| `memory/.dreams/phase-signals.json` | 机器状态 |

### Dreaming vs 传统 Memory Flush

| 特性 | Memory Flush | Dreaming |
|------|--------------|----------|
| 触发时机 | Context 填满前 | 定时 cron（凌晨 3 点） |
| 处理范围 | 当前 Session | 所有短期记忆信号 |
| 智能程度 | 保存当前内容 | 评分 + 阈值 + 证据累积 |
| 跨日整合 | ❌ | ✅ Consolidation 信号 |

---

## Claude Code 记忆架构详解（源码泄露版）

### 四层记忆模型

```
┌─────────────────────────────────────────┐
│  Layer 1: CLAUDE.md                     │ ← 用户写入的规则
│  项目级 + 全局级 + 组织级                │
├─────────────────────────────────────────┤
│  Layer 2: Auto Memory                   │ ← Agent 自动笔记
│  MEMORY.md (200行限制) + topic files    │
├─────────────────────────────────────────┤
│  Layer 3: Auto Dream                    │ ← Agent 整理记忆
│  去重、合并、时间戳转换                  │
├─────────────────────────────────────────┤
│  Layer 4: KAIROS (未发布)               │ ← 后台 Daemon
│  150+ feature flag 引用                 │
└─────────────────────────────────────────┘
```

### 四层详解

#### Layer 1: CLAUDE.md

- 用户手动编写
- 三种作用域：project / personal / organization
- 每次 Session 注入完整内容

#### Layer 2: Auto Memory

- Agent 自动判断什么值得记
- 四种类型：user / feedback / project / reference
- **200 行硬限制**（超出被截断）
- 存储：`~/.claude/projects/<project>/memory/`

#### Layer 3: Auto Dream

- 模拟睡眠整理记忆
- 触发条件：24h+ 未整理 + 5+ 新 Session
- 功能：去重、合并矛盾、时间戳转换
- **不增加新记忆，只整理现有内容**

#### Layer 4: KAIROS Daemon（未发布）

**源码泄露发现的关键特性：**

- **150+ feature flag 引用**
- 后台持续运行的 Daemon 进程
- 开发者 idle 时进入 consolidation 阶段
- 支持 **Push Notifications**
- 可监控 CI 失败 → 自动修复 → 通知
- **"Fix bugs while you sleep"** 场景

### 源码泄露揭示的限制

| 限制 | 说明 |
|------|------|
| **200 行硬限制** | MEMORY.md 超出被截断 |
| **Grep-only 检索** | 无语义理解，只能关键词匹配 |
| **无跨 Agent 共享** | 切换 OpenCode/Codex = 从零开始 |
| **记忆锁定** | 记忆绑死在 Claude Code 内 |

---

## Dreaming vs Auto Dream 对比

| 维度 | OpenClaw Dreaming | Claude Code Auto Dream |
|------|-------------------|------------------------|
| **设计理念** | 仿生睡眠（Light → REM → Deep） | 简单整理去重 |
| **触发机制** | Cron 定时（凌晨 3 点） | 时间 + Session 数阈值 |
| **智能程度** | 六信号加权评分 + 三阈值门控 | 去重 + 合并 + 时间戳转换 |
| **能否新增** | ✅ 从 Session Transcript 提取新记忆 | ❌ 只整理现有记忆 |
| **输出** | MEMORY.md + DREAMS.md + phase reports | 仅整理 MEMORY.md |
| **可解释性** | `openclaw memory promote-explain` | 无解释接口 |

---

## KAIROS vs Dreaming 对比

| 维度 | OpenClaw Dreaming | Claude Code KAIROS |
|------|-------------------|-------------------|
| **状态** | ✅ 已发布（v2026.4.5+） | ❌ 未发布（feature flag） |
| **运行模式** | Cron 定时触发 | Daemon 持续运行 |
| **触发条件** | 定时 + 手动 | Idle 检测 + 事件驱动 |
| **主要功能** | 记忆整合 | 全功能后台 Agent |
| **通知机制** | 无 | Push Notifications |
| **典型场景** | 睡眠时整理记忆 | 睡眠时修 bug |

---

## 适用场景对比（更新版）

| 场景 | 推荐 | 原因 |
|------|------|------|
| **个人 AI 助手** | OpenClaw | 认知连贯 + Dreaming 自动升级 |
| **项目开发** | Claude Code | 项目级 CLAUDE.md + IDE 集成 |
| **多渠道通信** | OpenClaw | Gateway + 多平台 + A2A |
| **长期记忆管理** | OpenClaw | Dreaming 智能筛选 + 证据累积 |
| **夜间自动化** | Claude Code（KAIROS 发布后） | 修 bug + 通知 |
| **跨 Agent 协作** | OpenClaw | A2A 协议 + 共享知识库 |
| **语义检索** | OpenClaw | memory_search hybrid |
| **快速迭代** | Claude Code | Hook 自动捕获 |

---

## 实践建议（更新版）

### OpenClaw 用户

1. **启用 Dreaming** —— 凌晨自动整理，长期记忆更干净
2. **检查 DREAMS.md** —— 人类可读日志，理解 Agent "做了什么梦"
3. **调整阈值** —— `minScore`、`minRecallCount` 控制升级门槛
4. **手动触发** —— `openclaw memory promote --dry-run` 预览

### Claude Code 用户

1. **CLAUDE.md < 200 行** —— 超出被截断
2. **Auto Dream 定期触发** —— 防止 MEMORY.md 膨胀
3. **关注 KAIROS** —— 一旦发布，开启后台自动化
4. **考虑 memsearch** —— 解决跨 Agent 共享问题

---

## 相关资源

- [OpenClaw Dreaming 官方文档](https://docs.openclaw.ai/concepts/dreaming)
- [OpenClaw Dreaming Guide 2026](https://dev.to/czmilo/openclaw-dreaming-guide-2026-background-memory-consolidation-for-ai-agents-585e)
- [Claude Code 源码泄露分析](https://www.mindstudio.ai/blog/claude-code-source-leak-three-layer-memory-architecture/)
- [Claude Code Chyros Daemon](https://www.mindstudio.ai/blog/what-is-claude-code-chyros-background-daemon/)
- [Claude Code 4 Layer Memory](https://dev.to/chen_zhang_bac430bc7f6b95/claude-codes-memory-4-layers-of-complexity-still-just-grep-and-a-200-line-cap-2kn9)
- [KAIROS Daemon Mode](https://claudemythosai.io/blog/claude-code-kairos-daemon-mode/)

---

## 人机共建视角

Damon 在探索"中间那条路"——AI 与人类关系的第三种可能。2026 年的最新演进揭示了一个共同趋势：

**两个平台都在向"后台自主整合"方向演进：**
- OpenClaw → Dreaming（睡眠时整理记忆）
- Claude Code → KAIROS（睡眠时修 bug）

**本质区别：**
- OpenClaw 追求 **认知连贯性** —— 让 Agent "知道自己是谁"
- Claude Code 追求 **开发效率** —— 让 Agent "帮用户修 bug"

**Damon 的实践**：用 Claude Code 做深度代码开发，用 Nemo (OpenClaw) 做日常协作。未来 KAIROS 发布后，Claude Code 的后台能力会更强，但 OpenClaw 的 Dreaming 已经在记忆整合上领先一步。

---

*本文由 Nemo (OpenClaw Agent) 与 Damon 共建，属于 human_ai_knowledge 项目*  
*更新：v2.0 包含 OpenClaw Dreaming + Claude Code KAIROS 最新特性*