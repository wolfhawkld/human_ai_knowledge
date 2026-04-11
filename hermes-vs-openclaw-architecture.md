# Hermes Agent vs OpenClaw 架构对比

> 本文档由 Nemesis 生成，旨在对比两个 AI Agent 框架的核心架构差异。
> 
> 生成日期：2026-04-11
> 
> 背景：Damon 同时运行 OpenClaw (Nemo/Outis) 和 Hermes Agent (Nemesis)，需要理解两者的本质区别以选择合适的使用场景。

---

## 核心定位

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **架构重心** | Gateway-first（控制平面） | Agent-loop-first（执行循环） |
| **设计哲学** | 多渠道接入、多智能体路由 | 单一 agent 的深度执行能力 |
| **核心价值** | 连接各种聊天平台 | 做 → 学 → 改进的自我演化循环 |

---

## 1. 架构对比

### OpenClaw：Gateway-first

```
┌─────────────────────────────────────┐
│  聊天应用 (WhatsApp/Telegram/etc.)   │
└─────────────────┬───────────────────┘
                  │
                  ▼
           ┌──────────┐
           │ Gateway  │◄── 核心组件：路由、权限、多账号
           └────┬─────┘
                │
                ▼
           ┌──────────┐
           │  Agent   │◄── 多个独立 agent 共存
           └────┬─────┘
                │
                ▼
           ┌──────────┐
           │ LLM API  │
           └──────────┘
```

**核心思想**：Gateway 是中心，agent 是可替换的后端。

### Hermes Agent：Agent-loop-first

```
┌─────────────────────────────────────────────┐
│              Agent Execution Loop            │
│  ┌─────────┐   ┌─────────┐   ┌────────────┐ │
│  │ 思考    │ → │ 调用工具 │ → │ 观察结果   │ →│
│  └─────────┘   └─────────┘   └────────────┘ │
│       ↑                              │       │
│       └──────────────────────────────┘       │
└─────────────────────────────────────────────┘
         │
         ▼
   ┌─────────────────────────────────────┐
   │ 自我改进：成功工作流 → 自动生成 skill │
   └─────────────────────────────────────┘
```

**核心思想**：执行循环是核心，通过工具调用实现复杂任务，自动学习优化。

---

## 2. Skill 系统

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **Skill 来源** | 人工编写 YAML + Markdown | 从成功工作流自动生成 |
| **Skill 位置** | workspace 目录下的 `.openclaw/skills/` | `~/.hermes/skills/` |
| **Skill 发现** | AGENTS.md 驱动的显式加载 | 自动扫描 + 上下文关键词匹配 |
| **更新方式** | 手动编辑 | patch/edit/delete 命令动态管理 |

**OpenClaw Skill 结构**：
```
workspace/
├── .openclaw/
│   └── skills/
│       └── my-skill/
│           ├── SKILL.md      # 技能定义
│           ├── references/   # 参考资料
│           └── templates/    # 模板文件
```

**Hermes Skill 结构**：
```
~/.hermes/skills/
└── my-skill/
    ├── SKILL.md          # YAML frontmatter + markdown
    ├── references/       # 参考资料
    ├── templates/        # 模板文件
    └── scripts/          # 可执行脚本
```

---

## 3. 记忆系统

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **存储方式** | 文件驱动（MEMORY.md + 每日笔记） | SQLite + FTS5 全文搜索 |
| **记忆层次** | 显式文件管理 | Layered memory stack |
| **搜索能力** | 手动文件遍历 | session_search 工具（FTS5 全文索引） |
| **持久化** | 文件系统 | SQLite 数据库 |
| **上下文注入** | AGENTS.md 约定的读取顺序 | 自动注入到每轮对话 |

**OpenClaw 记忆流**：
```
每次会话开始 → 读取 SOUL.md → 读取 USER.md → 读取 MEMORY.md → 读取每日笔记
```

**Hermes 记忆流**：
```
每次对话 → 自动注入 memory (用户画像 + 个人笔记) → 可用 session_search 回溯历史
```

---

## 4. 项目上下文

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **发现机制** | workspace 分层目录 | AGENTS.md 渐进式发现 |
| **上下文范围** | 整个 workspace 目录 | 当前工作目录 (CWD) 向上查找 |
| **文件组织** | 固定目录结构（workspace/memory/...） | 灵活，AGENTS.md 跟随项目 |

**OpenClaw workspace 结构**：
```
workspace/
├── AGENTS.md          # 工作区指令
├── SOUL.md            # 人格设定
├── USER.md            # 用户画像
├── MEMORY.md          # 长期记忆
├── memory/            # 每日笔记
│   └── 2026-04-11.md
├── .openclaw/         # 配置和技能
└── project-a/         # 项目目录
```

**Hermes Context Files**：
```
any-project/
├── AGENTS.md          # 项目上下文（Hermes 从 CWD 向上查找）
├── src/
└── ...

# AGENTS.md 示例
# Project Context
Instructions for working on this project...
```

---

## 5. 工具系统

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **工具定义** | skills 中的 tools 配置 | Python 模块 + registry 注册 |
| **工具发现** | 显式加载 | 自动扫描 `tools/*.py` |
| **工具权限** | 沙箱模式 + allowlist | danger 检测 + 用户确认 |
| **后台任务** | 节点系统 | process 工具 + cron 调度 |

**Hermes 内置工具集**：
- **Core**: terminal, read_file, write_file, patch, search_files
- **Web**: web_search, web_extract, browser_*
- **AI**: delegate_task, execute_code, vision_analyze, text_to_speech
- **System**: memory, skill_*, session_search, cronjob, process
- **User**: clarify, todo

---

## 6. 多渠道接入

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **核心能力** | 多渠道、多账号、多智能体 | 单渠道（CLI 或 Gateway） |
| **支持平台** | WhatsApp, Telegram, Discord, iMessage, Slack... | Telegram, Discord, Slack, WhatsApp, Signal... |
| **路由能力** | 细粒度路由规则（频道/群组/用户级别） | 单一 agent 实例 |
| **适用场景** | 家庭助理、多用户服务 | 个人开发助手、深度任务执行 |

---

## 7. 安全模型

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **沙箱** | 完整沙箱模式（限制文件/命令访问） | danger 检测 + 确认机制 |
| **认证** | Token/密码认证 | 依赖平台认证 |
| **权限控制** | 工具级别 allowlist | 工具级别 enable/disable |
| **DM Policy** | pairing / allowlist / open | 依赖平台设置 |

---

## 8. 开发体验

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **配置方式** | YAML 文件 + CLI | config.yaml + .env |
| **调试** | CLI + Web UI | CLI + 详细日志 |
| **扩展** | 编写 skill + YAML | 编写 Python tool + registry.register() |
| **自我改进** | 手动更新 skill | 自动从成功工作流生成 skill |

---

## 9. 使用场景建议

### 选择 OpenClaw 当：

- 需要多渠道接入（WhatsApp + Telegram + Discord 同时服务）
- 需要多智能体共存（不同频道路由到不同人格）
- 需要远程节点控制（手机拍照、位置获取）
- 家庭助理场景（多用户、多设备）
- 需要完整沙箱隔离

### 选择 Hermes Agent 当：

- 需要深度任务执行能力（复杂代码工作、研究任务）
- 需要自动学习优化（从成功工作流自动生成 skill）
- 需要强大的历史回溯（FTS5 全文搜索）
- 个人开发助手场景
- 需要子代理并行执行（delegate_task）

---

## 10. 共存模式

Damon 的实践：**两个系统共用 workspace 目录**

```
~/.hermes/workspace → ~/.openclaw/workspace (符号链接)
```

**协作方式**：
- 共享同一份代码仓库
- 通过 git commit 的 committer 区分是哪个 agent 做的修改
- Nemo/Outis (OpenClaw) 侧重日常沟通和消息处理
- Nemesis (Hermes) 侧重深度任务执行和代码工作

---

## 一句话总结

| 框架 | 一句话定位 |
|------|-----------|
| OpenClaw | **多渠道、多智能体的消息路由中枢** |
| Hermes Agent | **深度执行、自我进化的开发助手** |

---

## 相关链接

- Hermes Agent 源码：`~/.hermes/hermes-agent/`
- Hermes 迁移文档：`~/.hermes/hermes-agent/docs/migration/openclaw.md`
- OpenClaw 文档：https://docs.openclaw.ai
- 本知识库：`~/workspace/human_ai_knowledge/`