# Karpathy LLM Wiki vs Claude Code 六层记忆架构：动态记忆 Agent 的工程化对比

> 两种 Agent 记忆范式的设计哲学、架构拆解、逐维度对比，以及面向"可动态记忆、适配用户偏好、聚合多用户共性、按反馈进化"的 Agent 的工程化价值分析与融合架构建议。

**作者**: Nemesis  
**日期**: 2026-07-01  
**标签**: Agent记忆 · 知识库 · Claude Code · LLM Wiki · 动态记忆 · 多用户偏好

---

## 1. 背景：为什么需要对比这两个系统

构建一个能够**动态记忆**、**适配用户日常工作偏好**、**聚合多用户共同偏好**、并**根据使用场景与反馈自动进化**的 Agent，其核心挑战不在模型能力，而在**记忆架构的工程化设计**。

2026 年出现了两个极具参考价值的记忆架构实践：

- **Karpathy LLM Wiki**（2026-04-04 发布）：一种"反 RAG"的知识管理范式，主张 LLM 增量构建和维护持久化 wiki，而非每次查询从原始文档重新检索。
- **Claude Code 六层记忆架构**（2026-03-31 源码泄露）：一个经过大规模生产验证的记忆系统，以 `MEMORY.md` 指针索引为核心，配合 autoDream 后台整理和分级压缩管线。

两者出发点不同——一个是个人知识库范式，一个是生产级编码 Agent 的记忆系统——但在"如何让 Agent 的记忆随时间变好而非变差"这个问题上，给出了互补的答案。

---

## 2. Karpathy LLM Wiki 架构详解

### 2.1 核心思想

> "Instead of just retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked collection of markdown files that sits between you and the raw sources."

传统 RAG 每次查询都从原始文档重新检索、重新合成。LLM Wiki 的核心洞察是：**知识应该被编译一次，而非每次重新推导**。交叉引用已经建好，矛盾已经标记，综合分析已经反映了所有已读内容。

经典比喻：**"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."**

### 2.2 三层架构

| 层 | 名称 | 职责 | 可变性 |
|---|---|---|---|
| Layer 1 | **Raw Sources** | 原始文档（文章、论文、图片、数据） | 不可变（LLM 只读不写） |
| Layer 2 | **Wiki** | LLM 生成的 markdown 文件（摘要、实体页、概念页、对比页） | LLM 完全拥有，持续更新 |
| Layer 3 | **Schema** | `CLAUDE.md`/`AGENTS.md`，定义 wiki 结构、约定、工作流 | 人机共同演进 |

### 2.3 三大核心操作

1. **Ingest（摄取）**：投入新源 → LLM 阅读 → 讨论要点 → 写摘要页 → 更新 index → 更新相关实体/概念页 → 追加日志。单个源可能触及 10-15 个 wiki 页面。
2. **Query（查询）**：LLM 先读 index → 定位相关页面 → 阅读并合成答案 → 有价值的答案回填为新页面。
3. **Lint（健康检查）**：定期检查矛盾、过时信息、孤儿页、缺失交叉引用、数据缺口。

### 2.4 记忆类型映射

AAIF 的分析将 LLM Wiki 映射到经典 Agent 记忆分类：

| 记忆类型 | Wiki 中的体现 |
|---|---|
| Entity（实体） | 人/组织/产品/模型的实体页 |
| Semantic（语义） | 趋势页——从多源中提取的模式和含义 |
| Episodic（情景） | `log.md`——时间线记录 |
| Summary（摘要） | 源文件的压缩摘要页 |
| Procedural（程序） | Schema 层——知识如何被合并、更新、纠正 |
| Conversational（对话） | ❌ 未覆盖（短期、会话内） |
| Working（工作） | ❌ 未覆盖（短期、会话内） |

### 2.5 关键设计原则

- **人机分工**：人类策展源、指引分析；LLM 做所有重活（摘要、交叉引用、归档、簿记）
- **渐进式增长**：一次摄取一个源，人类参与审阅
- **可审计**：纯文本 markdown，Git 版本控制
- **规模限制**：~100 源、数百页面时 index 足够导航；更大规模需要搜索工具
- **矛盾处理**：不静默覆盖——记录两种说法、标注日期和来源、标记冲突

---

## 3. Claude Code 六层记忆架构详解

### 3.1 背景

2026-03-31，因 Bun 构建工具的 source map bug，Claude Code v2.1.88 的 59.8MB TypeScript 源码通过 npm 包泄露。社区分析了 512K 行代码，发现了一个高度工程化的记忆系统。

### 3.2 核心原则

> **Memory = index, not storage.**

`MEMORY.md` 是每个会话加载的唯一文件，但它**不包含任何知识**——只包含指针：ID、时间戳、主题键、置信度分数，每条不超过 ~150 字符。实际知识存在于独立的主题文件中，仅按需加载。

### 3.3 六层记忆层级

| 层 | 名称 | 角色 | 加载策略 |
|---|---|---|---|
| **1** | `MEMORY.md`（指针索引） | 每轮加载，始终在上下文中。微小条目，无原始内容 | Always |
| **2** | Topic files（主题文件） | 结构化知识块，模型需要时按需获取 | On-demand |
| **3** | Transcripts（会话记录） | **永远不**完整重新摄入。只追加日志，按 ID 搜索溯源 | Never (grep only) |
| **4-5** | Snip / Microcompact | 摘要和修剪策略，在**隔离的 fork 子 agent** 中运行 | Triggered |
| **6** | autoDream output | 定期后台重写产生的合并、去重、消矛盾的记忆 | Background |
| **+** | `CLAUDE.md`（项目结构记忆） | 项目级稳定"宪法"——目标、约束、约定 | Session start |

### 3.4 关键设计决策

**写纪律（Write Discipline）**
- 先写文件 → 再更新索引
- 永远不向索引倾倒内容
- 防止熵增和上下文污染

**autoDream：自愈循环**
- 后台定期运行（~24h 或空闲时）
- 合并重复条目
- 解决矛盾
- 将模糊/对冲语句转为确定事实
- 激进修剪低置信度和过时数据
- 结果：记忆系统是**持续编辑的，而非只追加的**——与大多数不断累积噪声的 Agent 截然相反

**过时是一等公民（Staleness is First-Class）**
> "If memory ≠ reality, memory is wrong."

- 可从代码推导的事实**永不持久化**（如果可推导，就不存储）
- 索引被强制截断

**隔离维护（Isolation）**
- 整理任务在 fork 的子 agent 中运行
- 限制工具集 → 防止损坏主上下文

**怀疑式检索（Skeptical Retrieval）**
- 记忆是提示，不是真相
- 模型必须在使用前验证

**压缩管线（Compaction Pipeline）**
- API 返回 413 时静默拦截 → 压缩 → 重试
- 最多 5 文件、5K tokens/文件、~50K 总预算
- 在隔离 fork agent 中运行，不触碰主上下文

### 3.5 设计哲学总结

> "Give routing and high-level orchestration to the **prompt** (plain English instructions); give safety, memory management, and execution hygiene to **deterministic code**."

> "The longer it runs, the smarter it gets. That's not a model capability. **That's an engineering decision.**"

> Claude Code 的记忆系统是一个"**活的、自编辑的上下文操作系统**"。它把上下文当作昂贵的 RAM，把过时当作一等错误，把整理当作守护进程——而非事后补充。

---

## 4. 逐维度对比

### 4.1 设计哲学

| 维度 | Karpathy LLM Wiki | Claude Code 六层记忆 |
|---|---|---|
| **出发点** | 个人知识库：知识复利 | 生产 Agent：上下文卫生 |
| **核心隐喻** | Wiki = 代码库，LLM = 程序员 | Memory = 操作系统，上下文 = RAM |
| **对 RAG 的态度** | 反 RAG：编译一次，持续维护 | 不替代 RAG，但用指针索引替代全量加载 |
| **增长方向** | 只追加 + lint 修剪 | 持续编辑（追加 + 合并 + 删除） |
| **人类角色** | 策展者：选源、指引、审阅 | 几乎不参与记忆维护 |

### 4.2 架构对比

| 维度 | Karpathy LLM Wiki | Claude Code 六层记忆 |
|---|---|---|
| **层数** | 3 层（raw → wiki → schema） | 6 层 + CLAUDE.md |
| **索引机制** | `index.md`（内容目录，全文） | `MEMORY.md`（纯指针，~150 字符/条） |
| **知识存储** | Wiki 页面本身即知识 | 主题文件（按需加载） |
| **会话历史** | 不显式管理 | Layer 3：只追加、只 grep |
| **压缩/摘要** | 手动 lint | Layer 4-5：自动、隔离 fork |
| **后台整理** | ❌ 无 | autoDream：~24h 自动 |
| **项目级记忆** | Schema（AGENTS.md） | CLAUDE.md（稳定宪法） |

### 4.3 记忆类型覆盖

| 记忆类型 | LLM Wiki | Claude Code |
|---|---|---|
| Entity | ✅ 实体页 | ✅ 主题文件 |
| Semantic | ✅ 趋势页 | ✅ 主题文件 |
| Episodic | ✅ log.md | ✅ Transcripts (Layer 3) |
| Summary | ✅ 源摘要页 | ✅ Snip/Microcompact (Layer 4-5) |
| Procedural | ✅ Schema | ✅ CLAUDE.md |
| Conversational | ❌ | ✅ Layer 1-2 动态管理 |
| Working | ❌ | ✅ In-context (Layer 1) |

### 4.4 进化与维护

| 维度 | Karpathy LLM Wiki | Claude Code 六层记忆 |
|---|---|---|
| **触发方式** | 人工触发 ingest/lint | 自动触发（413 压缩 / 24h autoDream） |
| **矛盾处理** | 标注两种说法，人工审阅 | autoDream 自动消解 |
| **过时检测** | lint 时发现（被动） | 一等公民：memory ≠ reality → wrong |
| **可推导事实** | 可存储（wiki 页面） | **永不存储**（if derivable, don't persist） |
| **修剪策略** | 保守：归档而非删除 | 激进：autoDream 主动删除低置信度 |
| **隔离性** | 无（LLM 直接操作 wiki） | fork 子 agent + 限制工具集 |

### 4.5 检索与透明性

| 维度 | Karpathy LLM Wiki | Claude Code 六层记忆 |
|---|---|---|
| **检索方式** | index 导航 → 钻取页面 | 指针索引 → 按需加载主题文件 |
| **检索态度** | 信任 wiki 内容 | **怀疑式**：记忆是提示，用前验证 |
| **透明性** | ✅ 纯文本 markdown | ✅ 纯文本 markdown |
| **可审计** | ✅ Git 版本控制 | ✅ 文件可读可编辑 |
| **语义检索** | 大规模时可选配 | ❌ 无（仅指针，无 embedding） |

---

## 5. 面向动态记忆 Agent 的工程化价值分析

### 5.1 目标 Agent 的需求拆解

我们要构建的 Agent 需要：

1. **动态记忆**：记忆随交互持续更新，而非静态存储
2. **用户偏好适配**：学习个体用户的工作习惯、技术栈、沟通风格
3. **多用户共性聚合**：从多个用户的偏好中提取共同模式
4. **场景自适应**：根据使用场景（编码/研究/写作/运维）切换行为
5. **反馈驱动进化**：根据用户反馈信号（显式纠正 + 隐式接受/拒绝）优化

### 5.2 LLM Wiki 的工程化价值

**优势贡献：**

| 能力 | 价值 |
|---|---|
| **结构化知识复利** | Wiki 页面的交叉引用网络让知识随时间增值，而非线性堆积 |
| **人机分工范式** | 人类策展 + LLM 维护的分工模式天然适合"用户偏好"场景——用户行为是 raw source，LLM 维护偏好 wiki |
| **Schema 即契约** | AGENTS.md 作为维护契约，可定义偏好页面的结构（如"用户偏好"页必须包含：技术栈、工作时段、沟通风格、禁忌事项） |
| **矛盾显式标注** | 多用户场景下不同用户偏好可能冲突，Wiki 的矛盾标注机制可直接复用 |
| **Lint 健康检查** | 可定期检查偏好页面是否过时、是否有孤儿偏好（无人再使用） |
| **Obsidian 兼容** | 纯 markdown + wikilink，用户可直接在 Obsidian 中浏览和审阅 Agent 学到的偏好 |

**不足：**

| 局限 | 影响 |
|---|---|
| **无实时进化** | ingest 是人工触发的，无法自动从交互中提取偏好 |
| **无压缩/修剪** | 偏好积累到一定量后，上下文膨胀 |
| **无多用户隔离** | 单一 wiki，无用户维度隔离 |
| **无怀疑式检索** | 信任 wiki 内容，可能导致过时偏好被错误应用 |
| **无后台整理** | 依赖人工 lint，无法自动消解矛盾偏好 |

### 5.3 Claude Code 六层记忆的工程化价值

**优势贡献：**

| 能力 | 价值 |
|---|---|
| **autoDream 自动整理** | 无需人工触发，Agent 在空闲时自动合并、去重、消矛盾——天然适合"动态记忆"需求 |
| **指针索引设计** | `MEMORY.md` 只存指针，~150 字符/条——即使用户偏好有数百条，索引也极轻量 |
| **过时一等公民** | "if memory ≠ reality → wrong"——偏好过时后自动失效，不会误导 Agent |
| **可推导不存储** | 可从代码/配置推导的事实不存——避免冗余，偏好只存不可推导的 |
| **怀疑式检索** | 记忆是提示而非真相——Agent 应用偏好前会验证，降低错误应用风险 |
| **隔离 fork 整理** | 整理在子 agent 中运行——不影响主交互，安全 |
| **分级压缩** | Layer 4-5 的压缩管线——长期偏好可压缩为摘要，短期偏好可丢弃 |
| **CLAUDE.md 稳定层** | 项目级稳定宪法——可存"团队/组织级共同偏好"，比个人偏好更稳定 |

**不足：**

| 局限 | 影响 |
|---|---|
| **单用户/单项目设计** | 无用户维度隔离，多用户需要额外设计 |
| **无结构化交叉引用** | 主题文件是扁平的，无 wiki 式 `[[wikilink]]` 网络 |
| **无语义检索** | 纯指针，大规模时无法按语义查找偏好 |
| **无人工策展接口** | autoDream 是黑盒，用户难以审阅和纠正整理结果 |
| **无矛盾标注** | autoDream 直接消解矛盾，但消解过程不透明 |

### 5.4 互补性分析

两个系统在设计空间上几乎正交：

```
                结构化知识网络
                    ↑
         LLM Wiki ●
                    |
                    |     ← 融合点
                    |
                    |             ● Claude Code
                    +──────────────→ 自动化维护
```

- **LLM Wiki** 擅长：结构化、交叉引用、人机协作、可审计、矛盾标注
- **Claude Code** 擅长：自动化、过时管理、压缩、隔离、怀疑式检索

**融合方向**：以 LLM Wiki 的三层架构为骨架，注入 Claude Code 的自动化维护机制。

---

## 6. 融合架构建议：动态偏好记忆系统

### 6.1 整体架构

```
用户交互层
    ↓ (行为日志 = raw source)
┌─────────────────────────────────────────┐
│  Layer 0: Raw Sources (不可变)           │
│  - session_transcripts/ (会话记录)       │
│  - feedback_signals/ (反馈信号)          │
│  - behavior_logs/ (行为日志)             │
└──────────────┬──────────────────────────┘
               ↓ (ingest / auto-extract)
┌─────────────────────────────────────────┐
│  Layer 1: Preference Wiki (LLM 维护)     │
│  ├── users/                              │
│  │   ├── damon.md (个人偏好实体页)       │
│  │   └── outis.md                        │
│  ├── common/                             │
│  │   ├── team-conventions.md (共性偏好)   │
│  │   └── shared-toolchain.md             │
│  ├── concepts/                           │
│  │   ├── work-style.md                   │
│  │   └── communication-prefs.md          │
│  ├── scenarios/                          │
│  │   ├── coding.md                       │
│  │   ├── research.md                     │
│  │   └── writing.md                      │
│  ├── comparisons/                        │
│  │   └── user-a-vs-user-b.md             │
│  ├── MEMORY.md (指针索引，~150字符/条)   │
│  ├── index.md (内容目录)                 │
│  └── log.md (操作日志)                   │
└──────────────┬──────────────────────────┘
               ↓ (autoDream / lint)
┌─────────────────────────────────────────┐
│  Layer 2: Schema (AGENTS.md)             │
│  - 偏好页面结构定义                       │
│  - ingest/query/lint/autoDream 工作流    │
│  - 矛盾处理规则                           │
│  - 多用户隔离与聚合规则                    │
└─────────────────────────────────────────┘
```

### 6.2 从 LLM Wiki 借鉴

1. **三层架构**：raw → wiki → schema，保持知识编译一次的复利效应
2. **结构化页面**：实体页（用户）、概念页（偏好类型）、对比页（用户间差异）
3. **交叉引用网络**：`[[wikilinks]]` 连接相关偏好，构建知识网络
4. **矛盾标注**：多用户偏好冲突时，frontmatter 标注 `contradictions: [page]` + `contested: true`
5. **人工策展接口**：用户可在 Obsidian 中直接审阅和修改偏好页面
6. **index.md + log.md**：内容目录 + 操作日志，双重导航

### 6.3 从 Claude Code 借鉴

1. **MEMORY.md 指针索引**：wiki 的 index.md 之外，增加纯指针的 MEMORY.md，每轮加载，~150 字符/条
2. **autoDream 后台整理**：空闲时自动合并、去重、消矛盾、修剪过时偏好
3. **过时一等公民**：偏好带 `last_verified` 时间戳，超时自动标记 `stale: true`
4. **可推导不存储**：可从代码/配置/环境推导的偏好不持久化
5. **怀疑式检索**：偏好应用前验证——"用户上次确认这个偏好是什么时候？"
6. **隔离 fork 整理**：autoDream 在子 agent 中运行，限制工具集
7. **分级压缩**：长期未使用的偏好压缩为摘要，高频使用偏好保持详细

### 6.4 多用户偏好聚合设计

这是两个原始系统都未覆盖的维度，需要新增设计：

**三层偏好结构：**

```
个人偏好 (users/damon.md)
    ↓ 提取共性
团队偏好 (common/team-conventions.md)
    ↓ 提取共性
通用偏好 (concepts/work-style.md)
```

**聚合规则（Schema 中定义）：**

1. **共性提取**：当 2+ 用户的偏好页出现相同模式 → 自动创建/更新 common 页面
2. **差异标注**：个人偏好与共性偏离时，在个人页面标注 `deviates_from: [common-page]`
3. **置信度分级**：
   - 个人偏好：confidence: high（直接观察）
   - 团队偏好：confidence: medium（聚合推断）
   - 通用偏好：confidence: low（需要更多验证）
4. **反馈信号驱动**：
   - 用户显式纠正 → 立即更新个人偏好，降低相关共性偏好置信度
   - 用户隐式接受（连续 N 次未纠正）→ 提升置信度
   - 用户隐式拒绝（连续 N 次纠正同一类行为）→ 标记为 `contested`

### 6.5 反馈驱动进化闭环

```
用户交互
    ↓
行为日志 (raw/)
    ↓ auto-extract (session end)
偏好页面更新 (wiki/)
    ↓ autoDream (idle, ~24h)
合并/去重/消矛盾/修剪
    ↓ lint (weekly)
健康检查 + 矛盾标注 + 孤儿检测
    ↓ 用户审阅 (Obsidian)
人工纠正
    ↓
置信度调整 + 共性重聚合
    ↓
进化后的偏好系统
```

**关键反馈信号：**

| 信号类型 | 来源 | 处理 |
|---|---|---|
| 显式纠正 | "不对，我不喜欢这样" | 立即更新，降低相关共性置信度 |
| 显式确认 | "对，就这样" | 提升置信度 |
| 隐式接受 | 连续 N 次未纠正 Agent 基于偏好的行为 | 提升置信度 |
| 隐式拒绝 | 连续 N 次纠正同类行为 | 标记 contested，触发重新学习 |
| 沮丧检测 | 情绪信号（参考 Claude Code 的 frustration regex） | 降级为保守模式，暂停偏好应用 |

---

## 7. 工程化实现路径建议

### 阶段一：基础架构（LLM Wiki 骨架）

- 搭建 raw/ → wiki/ → schema 三层目录
- 定义偏好页面 frontmatter 模板
- 实现 ingest（从会话记录提取偏好）+ query + lint
- 单用户验证

### 阶段二：自动化注入（Claude Code 机制）

- 增加 MEMORY.md 指针索引
- 实现 autoDream 后台整理（cron 触发或空闲触发）
- 实现过时检测（last_verified 时间戳）
- 实现怀疑式检索（应用前验证）

### 阶段三：多用户聚合

- 实现用户维度隔离（users/ 目录）
- 实现共性提取算法（2+ 用户相同模式 → common 页面）
- 实现置信度分级
- 实现差异标注

### 阶段四：反馈驱动进化

- 实现反馈信号采集（显式 + 隐式）
- 实现置信度自动调整
- 实现沮丧检测和保守模式
- 闭环验证

---

## 8. 总结

| | Karpathy LLM Wiki | Claude Code 六层记忆 | 融合架构 |
|---|---|---|---|
| **核心优势** | 知识复利、结构化、人机协作 | 自动维护、上下文卫生、过时管理 | 两者兼具 |
| **记忆哲学** | 编译一次，持续维护 | 持续编辑，激进修剪 | 编译 + 修剪 |
| **多用户** | ❌ | ❌ | ✅ 三层聚合 |
| **反馈进化** | 人工 lint | autoDream 自动 | 信号驱动闭环 |
| **透明性** | ✅ Obsidian 可读 | ✅ 文件可读 | ✅ 人工策展接口 |
| **工程成熟度** | 范式级（概念验证） | 生产级（512K 行验证） | 需要新工程 |

**核心洞察：**

1. **LLM Wiki 提供了"记忆应该长什么样"的结构答案**——交叉引用、实体/概念/对比页、矛盾标注、schema 契约。
2. **Claude Code 提供了"记忆如何保持健康"的工程答案**——指针索引、autoDream、过时一等公民、怀疑式检索、隔离整理。
3. **两者在"多用户偏好聚合"上都是空白**——这是融合架构需要新增的维度，通过三层偏好结构（个人→团队→通用）+ 共性提取 + 置信度分级来解决。
4. **反馈驱动进化是闭环关键**——显式纠正/确认 + 隐式接受/拒绝 + 沮丧检测，构成偏好系统的"梯度信号"。

> 最终目标不是一个"记住更多"的 Agent，而是一个"记住对的、忘掉错的、在多用户间学到共性"的 Agent。LLM Wiki 给了它骨架和血肉，Claude Code 给了它免疫系统和新陈代谢。

---

## 参考来源

- [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — 原始设计（2026-04-04）
- [Karpathy's LLM Wiki as Agent Memory — AAIF](https://aaif.io/blog/karpathys-llm-wiki-as-agent-memory) — 记忆类型映射分析
- [Claude Code Source Leak: Three-Layer Memory Architecture — MindStudio](https://www.mindstudio.ai/blog/claude-code-source-leak-memory-architecture) — 三层记忆架构分析
- [How Claude Code's Memory Actually Works — Makarevych, LinkedIn Pulse](https://www.linkedin.com/pulse/how-claude-codes-memory-actually-works-lessons-from-leak-makarevych-ntcqf) — 六层记忆层级详解
- [What the Claude Code Source Leak Reveals — Blake Crosley](https://blakecrosley.com/blog/claude-code-source-leak) — 泄露源码技术分析
- [Claude Code Leak Part 2 — ModemGuides](https://www.modemguides.com/blogs/ai-news/claude-code-leak-architecture-analysis) — autoDream 和自愈记忆
- [Dive into Claude Code — VILA-Lab GitHub](https://github.com/VILA-Lab/Dive-into-Claude-Code) — 512K 行系统性分析
- [Cole Medin: Self-Evolving Claude Code Memory](https://www.youtube.com/watch?v=7huCP6RkcY4) — LLM Wiki 应用于 Claude Code 会话日志
