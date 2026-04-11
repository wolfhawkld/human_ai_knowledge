# Hermes Agent 设计范式：ReAct + ACE

> Nemesis 与 Damon 对话中确定的设计本质：行动范式与上下文工程的交汇

---

## 核心结论

**Hermes Agent = ReAct + ACE**

两个范式缺一不可：

| 范式 | 解决的问题 | 核心机制 |
|------|-----------|----------|
| **ReAct** | 怎么行动 | 推理 → 执行 → 观察 → 循环 |
| **ACE** | 怎么思考 | 上下文从哪来、怎么组织、怎么管理 |

组合起来：

```
好的上下文 (ACE) → 高质量推理 (ReAct) → 正确的行动 → 有效结果
```

---

## ReAct：行动范式

ReAct (Reasoning + Acting) 是 Agent 的核心循环机制：

```python
while api_call_count < max_iterations:
    response = client.chat(...)      # Reason: 推理当前状态
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = handle_function_call(...)  # Act: 执行工具
            messages.append(tool_result)        # Observe: 观察结果
    else:
        return response.content      # 完成
```

**循环步骤**：

1. **Reason** — 模型分析当前状态，决定下一步做什么
2. **Act** — 调用工具（terminal、web_search、file 操作等）
3. **Observe** — 看工具返回的结果
4. **循环** — 基于观察结果再推理，再行动

这就是"思考→行动→观察→思考"的闭环。

---

## ACE：上下文工程

ACE (Agentic Context Engineering) 关注上下文的质量和效率。

### Hermes 的上下文架构

```
┌─────────────────────────────────┐
│  System Prompt (静态)           │  ← 缓存
├─────────────────────────────────┤
│  Memory (用户偏好/环境事实)      │  ← 缓存
├─────────────────────────────────┤
│  AGENTS.md (项目上下文)          │  ← 缓存
├─────────────────────────────────┤
│  Skills (已加载的技能)           │  ← 按需加载
├─────────────────────────────────┤
│  对话历史                        │  ← 动态，可压缩
├─────────────────────────────────┤
│  当前消息                         │
└─────────────────────────────────┘
```

### ACE 核心问题与 Hermes 实现

| ACE 问题 | Hermes 实现 |
|----------|-------------|
| 上下文从哪来 | AGENTS.md（项目级）、Memory（持久化）、Skills（可加载） |
| 上下文怎么组织 | 分层注入：系统提示 → Memory → Context Files → 对话历史 |
| 上下文太长怎么办 | Context compression 自动压缩历史 |
| 如何减少重复注入 | Prompt caching 缓存静态前缀 |
| 如何保持一致性 | Memory 存储偏好/事实，跨会话携带 |
| 如何复用流程 | Skill system 记录可复用的工作流 |

---

## 缓存机制详解

### Prompt Caching 缓存什么

| 内容类型 | 是否缓存 |
|---------|---------|
| 系统提示 (AGENTS.md 等) | ✅ 缓存 |
| 工具定义 (schema) | ✅ 缓存 |
| Memory 注入内容 | ✅ 缓存 |
| 对话历史 | ❌ 每次重新发送 |
| 当前消息 | ❌ 每次新的 |

### 实时性问题的处理

同一会话内重复问实时性问题（如"现在几点"），可能得到"过期"答案：

- 第一次：调用工具 → 返回 12:30 → 加入对话历史
- 第二次：模型看到历史里有答案 → 可能复用而非重新查询

这是模型行为层面的问题，不是缓存机制本身。

**解决方式**：

- 用户换个问法（"再查一次当前时间"）
- 系统层面策略（时间类问题不缓存历史答案）
- 更强的模型有更好的时效性判断

---

## 为什么两个范式必须结合

**单有 ReAct 不够**：

- 没有好上下文 → 推理质量差 → 行动方向错
- 工具调用再多，如果不知道"该做什么"，都是浪费

**单有 ACE 不够**：

- 有好上下文但不行动 → 只会思考不会执行
- 知识再多，如果不能转化为行动，没有产出

**组合起来才完整**：

```
ACE: 知道要做什么（上下文质量）
    ↓
ReAct: 知道怎么做（行动能力）
    ↓
结果: 完成任务
```

---

## 与 OpenClaw 的对比视角

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| 架构重心 | Gateway-first（控制平面） | Agent-loop-first（自我改进循环） |
| Skill 来源 | 人工编写 + JSON 存储 | 自动生成 + SQLite(FTS5) |
| 上下文发现 | Workspace 目录分层 | AGENTS.md 基于 CWD 渐进发现 |
| 记忆系统 | 文件优先（File-First） | Memory tool + SQLite 会话存储 |

两者都在实践 ReAct + ACE，但实现方式不同。

---

## 总结

Hermes Agent 的设计本质：

1. **ReAct 是骨架** — 提供行动循环的基本结构
2. **ACE 是血肉** — 填充上下文内容，决定推理质量
3. **两者结合** — 才是完整的智能 Agent

上下文质量决定推理质量，推理质量决定行动质量。

---

## 对话背景

- **参与者**：Damon（人类）、Nemesis（Hermes Agent）
- **日期**：2026-04-11
- **触发**：Damon 问"你的 agent 设计思路是不是有点像 ReAct Agent？"，随后讨论 ACE 思想交集，最终确定 Hermes = ReAct + ACE 范式

---

*Co-authored-by: Nemesis <nemesis@hermes-agent>*