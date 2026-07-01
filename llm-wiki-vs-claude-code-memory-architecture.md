# Karpathy LLM Wiki vs Claude Code 记忆架构：动态记忆 Agent 的工程化对比

> 两种 Agent 记忆范式的设计哲学、架构拆解、逐维度对比，以及面向"可动态记忆、适配用户偏好、聚合多用户共性、按反馈进化"的 Agent 的工程化价值分析与融合架构建议。

**作者**: Nemesis  
**日期**: 2026-07-01  
**标签**: Agent记忆 · 知识库 · Claude Code · LLM Wiki · 动态记忆 · 多用户偏好

---

## 1. 背景：为什么需要对比这两个系统

构建一个能够**动态记忆**、**适配用户日常工作偏好**、**聚合多用户共同偏好**、并**根据使用场景与反馈自动进化**的 Agent，其核心挑战不在模型能力，而在**记忆架构的工程化设计**。

2026 年出现了两个极具参考价值的记忆架构实践：

- **Karpathy LLM Wiki**（2026-04-04 发布）：一种"反 RAG"的知识管理范式，主张 LLM 增量构建和维护持久化 wiki，而非每次查询从原始文档重新检索。
- **Claude Code 记忆架构**（2026-03-31 源码泄露 + 微信深度分析）：一个经过大规模生产验证的记忆系统，采用静态 CLAUDE.md 六层体系 + 动态自动记忆系统的双轨设计，核心纪律是"只记代码推不出来的东西"。

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

## 3. Claude Code 记忆架构详解

### 3.1 背景

2026-03-31，因 Bun 构建工具的 source map bug，Claude Code v2.1.88 的 59.8MB TypeScript 源码通过 npm 包泄露。社区分析了 512K 行代码。微信深度分析文章进一步梳理了完整的记忆机制设计。

### 3.2 核心问题：LLM 是无状态的

> LLM 本身根本「记不住」任何东西，它是彻头彻尾**无状态**的。每次按下回车，对它来说都是「从头看一遍」：把系统提示词、所有历史对话、当前问题，全部塞进去，然后输出一个回复。

Agent 真正需要记住的四类信息：
- **用户画像**（你是谁）
- **行为偏好**（你不喜欢什么/确认有效的做法）
- **项目动态**（当前项目要干啥、有什么截止日期）
- **外部指针**（去哪查什么信息）

### 3.3 业界四种主流方案及其硬伤

Claude Code 的设计是在看到以下四种方案的硬伤后才定型的：

| 方案 | 原理 | 硬伤 |
|---|---|---|
| **滑动窗口** | 保留最近 N 轮对话 | 关键信息和无关信息混在一起被丢 |
| **对话摘要** | 定期用 LLM 总结旧对话 | 重要细节被压糊；摘要本身耗 token |
| **向量检索**（Mem0/Letta/Zep） | embedding + 向量数据库 + 相似度召回 | 相似≠相关；召回不稳定；维护成本高；用户没法看 |
| **分层存储**（MemGPT/Letta） | core/recall/archival 三层 + LLM 主动搬数据 | 概念多、迁移成本大；搬数据依据仍是 embedding |

**四类方案的共同病根：**
1. 自由文本无约束 → 记忆库膨胀成垃圾堆
2. 不区分类型 → 全部一锅炖，查不准
3. 没有老化机制 → 过时记忆变成"权威的错误"
4. 重检索、轻写入 → 垃圾进、垃圾出

### 3.4 Claude Code 的两层记忆架构

Claude Code 走了一条"土到反直觉"的路——没用向量数据库，没用 embedding，用的是**磁盘上的 markdown 文件**。

| 层 | 本质 | 解决的问题 | 比喻 |
|---|---|---|---|
| **静态层（CLAUDE.md 体系）** | 声明式指令 | "我们怎么协作""项目遵守什么规则" | 公司员工手册 |
| **动态层（自动记忆系统）** | 学习式偏好 | "我从互动中学到了什么" | 自己的工作笔记 |

### 3.5 静态层：CLAUDE.md 的六个层级

六种来源的规则可见范围不同、谁能改也不同，硬塞进一个文件会打架或混乱。六层按加载顺序从低到高叠加，启动时全部拼接进 system prompt。

| 层级 | 位置 | 用途 | 文件 |
|---|---|---|---|
| **Managed** | 系统级路径 | 公司级强制策略（仅管理员可改） | CLAUDE.md |
| **User** | 用户家目录 | 个人全局偏好（跨所有项目） | CLAUDE.md |
| **Project** | 项目根目录/`.claude/` | 项目层规则（签入 git 共享） | CLAUDE.md |
| **Local** | 项目根目录 | 本地调试约定（不签入 git） | CLAUDE.local.md |
| **Auto**（AutoMem） | 项目级自动记忆目录 | Claude Code 自动写入的偏好 | MEMORY.md |
| **Team**（TeamMem） | Auto 目录下 `team/` 子目录 | 团队共享的 AI 学到的偏好（需 feature flag） | MEMORY.md |

**关键机制：**

- **@include 指令**：`@~/company/security-rules.md` 自动读取引用文件内容拼入，类似 C 语言 `#include`，防循环引用、防路径遍历
- **条件规则**（`.claude/rules/`）：按当前编辑文件路径匹配，只有相关规则才拼入 system prompt——按需注入，省 token
- **截断双保险**：`MAX_ENTRYPOINT_LINES = 200` + `MAX_ENTRYPOINT_BYTES = 25_000`，两个限制任意一个先触发就截断，防御长行索引炸弹

### 3.6 动态层：自动记忆系统的完整闭环

#### 四种记忆类型（强制分类）

```typescript
export const MEMORY_TYPES = [
  'user',       // 你是谁
  'feedback',   // 你不喜欢什么/确认有效的做法
  'project',    // 项目正在发生什么
  'reference',  // 去哪查什么
] as const
```

**feedback 和 project 的强制结构：**

```markdown
规则本身

**Why:** 用户为什么这么要求（往往是踩过的坑）
**How to apply:** 什么情况下生效
```

只记规则不记原因，遇到边界情况就抓瞎。加上 Why，agent 在边界情况下能**自己判断该不该破例**。

**project 类型的特殊要求**：必须把相对日期转成绝对日期（"周四之前冻结" → "2026-03-05 之前冻结"）

#### 不该存什么（禁令清单）

- 代码模式、架构、文件路径、项目结构（grep/CLAUDE.md 可得）
- Git 历史和最近改动（git log/git blame 是权威）
- 调试方案和修复方法（fix 已在代码里）
- CLAUDE.md 里已写过的内容
- 临时任务状态和当前对话上下文

> **核心纪律：只记代码推不出来的东西。** 代码是「活的」，记忆是「死的」。

#### 存储设计：单文件 + 索引

每条记忆是独立 `.md` 文件，带 YAML frontmatter。`MEMORY.md` 是索引——只塞「目录」（name + description），不塞「正文」。

```
MEMORY.md 索引 → 始终加载进 system prompt（~150 字符/条）
独立记忆文件 → 按需加载
```

类似翻工具书：不需要背全书，但得知道目录。

#### 写入：Extract Memories 代理

- **触发时机**：每轮 query loop 完整结束（无 tool call），通过 `stopHook` 钩子触发
- **核心设计**：fork 主对话，复用 prompt cache——不重新加载 system prompt，只看着对话历史决定"有没有值得记的"
- **逻辑**：扫描用户反馈/纠正 → 与现有记忆比对去重 → 按四种类型分类写文件
- 检测 `hasMemoryWritesSince`，避免对同一件事反复写记忆

#### 检索：用 Sonnet 选 top-5（非向量检索）

三步流程（`findRelevantMemories`）：

1. **扫描所有记忆文件头部**：只读前 30 行（提取 frontmatter）
2. **拼成标题清单发给 Sonnet**：Query + Available memories 列表
3. **Sonnet 用 JSON schema 返回 top-5 文件名**

> "Only include memories that you are certain will be helpful based on their name and description. Be selective and discerning."

**为什么用 Sonnet 不用 Haiku**：记忆相关性判错的代价远大于多花的钱，容错率极低。

**两个过滤细节**：
- `alreadySurfaced`：上一轮已露脸的记忆直接排除
- `recentTools`：最近用过工具的"用法参考文档"不选，但"警告、坑点、已知问题"记忆要保留

#### 注入：system-reminder 包裹 + 老化警告

```xml
<system-reminder>
This memory was saved 5 days ago. Verify it's still accurate before acting on it.
[记忆内容]
</system-reminder>
```

**老化机制**：今天/昨天 → 不警告；2 天以前 → 主动加 stale 警告。

> 记忆是提示，不是真相。模型必须在使用前验证。

#### autoDream：后台自愈循环

- 后台定期运行（~24h 或空闲时）
- 合并重复条目、解决矛盾、将模糊/对冲语句转为确定事实、激进修剪低置信度和过时数据
- 在**隔离的 fork 子 agent** 中运行，限制工具集 → 防止损坏主上下文
- 结果：记忆系统是**持续编辑的，而非只追加的**

### 3.7 设计哲学总结

> "Give routing and high-level orchestration to the **prompt** (plain English instructions); give safety, memory management, and execution hygiene to **deterministic code**."

> "The longer it runs, the smarter it gets. That's not a model capability. **That's an engineering decision.**"

> Claude Code 的记忆系统是一个"**活的、自编辑的上下文操作系统**"。它把上下文当作昂贵的 RAM，把过时当作一等错误，把整理当作守护进程——而非事后补充。

---

## 4. 逐维度对比

### 4.1 设计哲学

| 维度 | Karpathy LLM Wiki | Claude Code 记忆架构 |
|---|---|---|
| **出发点** | 个人知识库：知识复利 | 生产 Agent：上下文卫生 |
| **核心隐喻** | Wiki = 代码库，LLM = 程序员 | Memory = 操作系统，上下文 = RAM |
| **对 RAG 的态度** | 反 RAG：编译一次，持续维护 | 反向量检索：用 LLM 选 top-5，不用 embedding |
| **增长方向** | 只追加 + lint 修剪 | 持续编辑（追加 + 合并 + 删除） |
| **人类角色** | 策展者：选源、指引、审阅 | 几乎不参与记忆维护 |
| **对业界方案的态度** | 不提，但隐含反 RAG | 明确否定四种主流方案后另起炉灶 |

### 4.2 架构对比

| 维度 | Karpathy LLM Wiki | Claude Code 记忆架构 |
|---|---|---|
| **整体架构** | 3 层（raw → wiki → schema） | 2 层（静态 CLAUDE.md 六级 + 动态自动记忆闭环） |
| **静态/稳定层** | Schema（AGENTS.md）一层 | CLAUDE.md 六层叠加（Managed→User→Project→Local→Auto→Team） |
| **索引机制** | `index.md`（内容目录，全文） | `MEMORY.md`（纯指针，~150 字符/条） |
| **知识存储** | Wiki 页面本身即知识 | 独立记忆 .md 文件（按需加载） |
| **记忆分类** | 按页面类型（实体/概念/对比/查询） | 强制四种类型（user/feedback/project/reference） |
| **结构约束** | Schema 定义页面结构 | feedback/project 强制 Why + How to apply 结构 |
| **后台整理** | ❌ 无 | autoDream：~24h 自动，隔离 fork |
| **条件注入** | ❌ 无 | `.claude/rules/` 按文件路径匹配按需注入 |

### 4.3 记忆类型覆盖

| 记忆类型 | LLM Wiki | Claude Code |
|---|---|---|
| Entity（实体） | ✅ 实体页 | ✅ user 类型 |
| Semantic（语义） | ✅ 趋势页 | ✅ reference 类型 |
| Episodic（情景） | ✅ log.md | ✅ project 类型（带绝对日期） |
| Summary（摘要） | ✅ 源摘要页 | ✅ autoDream 合并输出 |
| Procedural（程序） | ✅ Schema | ✅ CLAUDE.md 六层体系 |
| Feedback（反馈） | ❌ | ✅ feedback 类型（Why + How） |
| Conversational（对话） | ❌ | ✅ 短期上下文 + compaction |
| Working（工作） | ❌ | ✅ In-context |

### 4.4 写入与检索

| 维度 | Karpathy LLM Wiki | Claude Code 记忆架构 |
|---|---|---|
| **写入触发** | 人工 ingest | stopHook 自动触发（每轮结束） |
| **写入方式** | LLM 直接写 wiki 页面 | fork 主对话 + 复用 prompt cache，去重后分类写入 |
| **检索方式** | index 导航 → 钻取页面 | Sonnet 读标题清单选 top-5（非向量） |
| **检索精度** | 依赖 LLM 自己导航 | 用 Sonnet（非 Haiku）确保准确性 |
| **检索态度** | 信任 wiki 内容 | **怀疑式**：记忆是提示，用前验证 + 老化警告 |
| **去重** | 人工 lint 时发现 | 自动 `hasMemoryWritesSince` 检测 |

### 4.5 进化与维护

| 维度 | Karpathy LLM Wiki | Claude Code 记忆架构 |
|---|---|---|
| **触发方式** | 人工触发 ingest/lint | 自动触发（stopHook / 413 压缩 / 24h autoDream） |
| **矛盾处理** | 标注两种说法，人工审阅 | autoDream 自动消解 |
| **过时检测** | lint 时发现（被动） | 一等公民：2 天后加 stale 警告；memory ≠ reality → wrong |
| **可推导事实** | 可存储（wiki 页面） | **永不存储**（if derivable, don't persist） |
| **修剪策略** | 保守：归档而非删除 | 激进：autoDream 主动删除低置信度 |
| **隔离性** | 无（LLM 直接操作 wiki） | fork 子 agent + 限制工具集 |

### 4.6 透明性与可审计

| 维度 | Karpathy LLM Wiki | Claude Code 记忆架构 |
|---|---|---|
| **透明性** | ✅ 纯文本 markdown | ✅ 纯文本 markdown + YAML frontmatter |
| **可审计** | ✅ Git 版本控制 | ✅ 文件可读可编辑 |
| **人机协作** | ✅ 人类策展 + LLM 维护 | ✅ 静态层人工写 + 动态层自动学 |
| **语义检索** | 大规模时可选配 | ❌ 无 embedding，纯 LLM 标题选择 |
| **Obsidian 兼容** | ✅ wikilink + 图谱视图 | ❌ 无 wikilink 网络 |

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
| **Schema 即契约** | AGENTS.md 作为维护契约，可定义偏好页面的结构 |
| **矛盾显式标注** | 多用户场景下不同用户偏好可能冲突，Wiki 的矛盾标注机制可直接复用 |
| **Lint 健康检查** | 可定期检查偏好页面是否过时、是否有孤儿偏好 |
| **Obsidian 兼容** | 纯 markdown + wikilink，用户可直接浏览和审阅 Agent 学到的偏好 |

**不足：**

| 局限 | 影响 |
|---|---|
| **无实时进化** | ingest 是人工触发的，无法自动从交互中提取偏好 |
| **无压缩/修剪** | 偏好积累到一定量后，上下文膨胀 |
| **无多用户隔离** | 单一 wiki，无用户维度隔离 |
| **无怀疑式检索** | 信任 wiki 内容，可能导致过时偏好被错误应用 |
| **无后台整理** | 依赖人工 lint，无法自动消解矛盾偏好 |

### 5.3 Claude Code 记忆架构的工程化价值

**优势贡献：**

| 能力 | 价值 |
|---|---|
| **强制四类分类** | user/feedback/project/reference 四类强制分类，避免"一锅炖"——偏好天然有分类归属 |
| **Why + How 结构** | feedback 类型强制写原因和适用条件——Agent 在边界情况下能自己判断该不该破例 |
| **stopHook 自动写入** | 每轮结束自动提取记忆，无需人工触发——天然适合"动态记忆"需求 |
| **fork + prompt cache** | 写入时 fork 主对话复用缓存，不重新加载 system prompt——写入成本低 |
| **Sonnet 选 top-5** | 用强模型选记忆而非向量检索——避免"相似≠相关"问题，准确性高 |
| **老化警告** | 2 天后加 stale 警告——偏好过时后 Agent 会主动验证，不会盲目应用 |
| **可推导不存储** | 只记代码推不出来的东西——避免冗余，偏好只存不可推导的 |
| **autoDream 自愈** | 后台自动合并、去重、消矛盾、修剪——记忆持续编辑而非只追加 |
| **CLAUDE.md 六层体系** | 静态层六层叠加——天然支持"团队级共同偏好"（Team 层）和"个人偏好"（User 层）的分层 |
| **条件规则注入** | `.claude/rules/` 按文件路径匹配——场景自适应（编码/研究/写作切换行为）的现成机制 |

**不足：**

| 局限 | 影响 |
|---|---|
| **单用户/单项目设计** | User 层是个人全局，但无多用户隔离和共性提取 |
| **无结构化交叉引用** | 记忆文件是扁平的，无 wiki 式 `[[wikilink]]` 网络 |
| **无语义检索** | 纯 LLM 标题选择，大规模时可能遗漏 |
| **autoDream 黑盒** | 用户难以审阅和纠正 autoDream 的整理结果 |
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
- **Claude Code** 擅长：自动写入、分类约束、老化管理、怀疑式检索、条件注入

**融合方向**：以 LLM Wiki 的三层架构为骨架，注入 Claude Code 的自动化维护机制和分类约束。

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
               ↓ (stopHook auto-extract / ingest)
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
│  - 偏好页面结构定义 + 四类分类强制约束    │
│  - feedback/project 强制 Why + How 结构  │
│  - ingest/query/lint/autoDream 工作流    │
│  - 矛盾处理规则                           │
│  - 多用户隔离与聚合规则                    │
│  - 条件规则 (scenarios/ 按需注入)         │
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

1. **强制四类分类**：user/feedback/project/reference，每条偏好必须归属一类
2. **Why + How 结构**：feedback 类型强制写原因和适用条件，让 Agent 在边界情况自行判断
3. **MEMORY.md 指针索引**：纯指针，~150 字符/条，始终加载
4. **stopHook 自动写入**：每轮结束 fork 主对话自动提取偏好，复用 prompt cache
5. **Sonnet 选 top-5**：用强模型从标题清单选偏好，非向量检索
6. **老化警告**：偏好带 `last_verified` 时间戳，2 天后加 stale 警告
7. **可推导不存储**：可从代码/配置/环境推导的偏好不持久化
8. **autoDream 后台整理**：空闲时自动合并、去重、消矛盾、修剪
9. **隔离 fork 整理**：autoDream 在子 agent 中运行，限制工具集
10. **条件规则注入**：scenarios/ 按使用场景按需注入偏好规则
11. **CLAUDE.md 六层体系**：静态层分层——Managed（组织级）→ User（个人级）→ Project（项目级）→ Team（团队共性级）

### 6.4 多用户偏好聚合设计

这是两个原始系统都未覆盖的维度。Claude Code 的 CLAUDE.md 六层体系中的 User 层和 Team 层提供了雏形，但缺乏自动共性提取。

**三层偏好结构：**

```
个人偏好 (users/damon.md)     ← Claude Code User 层
    ↓ 提取共性
团队偏好 (common/team-conventions.md)  ← Claude Code Team 层
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
    ↓ stopHook auto-extract (session end)
偏好页面更新 (wiki/) — 四类分类 + Why/How 结构
    ↓ autoDream (idle, ~24h)
合并/去重/消矛盾/修剪 — 隔离 fork
    ↓ lint (weekly)
健康检查 + 矛盾标注 + 孤儿检测 + 过时检测
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

### 阶段一：基础架构（LLM Wiki 骨架 + Claude Code 分类约束）

- 搭建 raw/ → wiki/ → schema 三层目录
- 定义偏好页面 frontmatter 模板 + 四类分类强制约束 + Why/How 结构
- 实现 ingest（从会话记录提取偏好）+ query + lint
- 单用户验证

### 阶段二：自动化注入（Claude Code 机制）

- 增加 MEMORY.md 指针索引
- 实现 stopHook 自动写入（fork + prompt cache）
- 实现 Sonnet 选 top-5 检索
- 实现老化警告（last_verified + stale 警告）
- 实现 autoDream 后台整理（cron 触发或空闲触发）
- 实现条件规则注入（scenarios/ 按需注入）

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

| | Karpathy LLM Wiki | Claude Code 记忆架构 | 融合架构 |
|---|---|---|---|
| **核心优势** | 知识复利、结构化、人机协作 | 自动维护、分类约束、老化管理 | 两者兼具 |
| **记忆哲学** | 编译一次，持续维护 | 只记代码推不出来的；持续编辑 | 编译 + 修剪 |
| **分类约束** | 页面类型（松散） | 四类强制 + Why/How（严格） | 四类 + Wiki 结构 |
| **检索方式** | index 导航 | Sonnet 选 top-5（非向量） | Sonnet + Wiki 交叉引用 |
| **多用户** | ❌ | ❌（Team 层有雏形） | ✅ 三层聚合 |
| **反馈进化** | 人工 lint | stopHook + autoDream 自动 | 信号驱动闭环 |
| **透明性** | ✅ Obsidian 可读 | ✅ 文件可读 | ✅ 人工策展接口 |
| **工程成熟度** | 范式级（概念验证） | 生产级（512K 行验证） | 需要新工程 |

**核心洞察：**

1. **LLM Wiki 提供了"记忆应该长什么样"的结构答案**——交叉引用、实体/概念/对比页、矛盾标注、schema 契约。
2. **Claude Code 提供了"记忆如何保持健康"的工程答案**——强制四类分类、Why/How 结构、stopHook 自动写入、Sonnet 选 top-5、老化警告、autoDream 自愈、可推导不存储。
3. **Claude Code 明确否定了向量检索路线**——用 Sonnet 从标题清单选 top-5 而非 embedding 相似度，因为"相似≠相关"，且人脑读不懂 768 维浮点数。
4. **两者在"多用户偏好聚合"上都是空白**——Claude Code 的 Team 层有雏形但无自动共性提取，需要通过三层偏好结构（个人→团队→通用）+ 共性提取 + 置信度分级来解决。
5. **反馈驱动进化是闭环关键**——显式纠正/确认 + 隐式接受/拒绝 + 沮丧检测，构成偏好系统的"梯度信号"。

> 最终目标不是一个"记住更多"的 Agent，而是一个"记住对的、忘掉错的、在多用户间学到共性"的 Agent。LLM Wiki 给了它骨架和血肉，Claude Code 给了它免疫系统和新陈代谢。

---

## 参考来源

- [Karpathy LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — 原始设计（2026-04-04）
- [Karpathy's LLM Wiki as Agent Memory — AAIF](https://aaif.io/blog/karpathys-llm-wiki-as-agent-memory) — 记忆类型映射分析
- [Claude Code 记忆机制深度解析 — 微信公众号](https://mp.weixin.qq.com/s/CLIuogpYSPng2brQph7AHg) — 四种方案硬伤分析、两层架构、CLAUDE.md 六层体系、四种记忆类型、stopHook 写入、Sonnet 选 top-5、老化机制（本文主要参考）
- [Claude Code Source Leak: Three-Layer Memory Architecture — MindStudio](https://www.mindstudio.ai/blog/claude-code-source-leak-memory-architecture) — 三层记忆架构分析
- [How Claude Code's Memory Actually Works — Makarevych, LinkedIn Pulse](https://www.linkedin.com/pulse/how-claude-codes-memory-actually-works-lessons-from-leak-makarevych-ntcqf) — 六层记忆层级详解
- [What the Claude Code Source Leak Reveals — Blake Crosley](https://blakecrosley.com/blog/claude-code-source-leak) — 泄露源码技术分析
- [Claude Code Leak Part 2 — ModemGuides](https://www.modemguides.com/blogs/ai-news/claude-code-leak-architecture-analysis) — autoDream 和自愈记忆
- [Dive into Claude Code — VILA-Lab GitHub](https://github.com/VILA-Lab/Dive-into-Claude-Code) — 512K 行系统性分析
- [Cole Medin: Self-Evolving Claude Code Memory](https://www.youtube.com/watch?v=7huCP6RkcY4) — LLM Wiki 应用于 Claude Code 会话日志
