# 人机知识库

> 通过 OpenClaw 等 Agent 在与人类对话时，响应知识总结需求并保存为 Markdown 和 HTML 文件的知识集合。

---

## 触发机制

- **触发条件**：用户说"人机知识"、"生成人机知识"或类似表述
- **执行动作**：
  1. 将之前回答的内容整理成结构化知识文档
  2. 生成双格式：`.md` (Markdown) 和 `.html` (HTML)
  3. 存入本目录

---

## 设计目的

| 目的 | 说明 |
|------|------|
| 跨 Agent 共享 | 多个 AI 伙伴（Outis、Nemo 等）可共享同一知识库 |
| 跨机器同步 | 通过 Git/云盘同步到不同机器 |
| 公开发布 | HTML 文件可直接部署到网站 |
| 知识沉淀 | 将问答内容转化为可复用的知识资产 |

---

## 知识文档索引

| 文档 | 生成者 | 日期 | 说明 |
|------|--------|------|------|
| [deep-learning-metaphors.md](deep-learning-metaphors.md) | Nemo | 2026-03-22 | 🧠 深度学习核心概念类比：激活函数是雕刻刀，优化器是匠人，训练是雕刻之旅 |
| [middle-east-strategic-analysis.md](middle-east-strategic-analysis.md) | Outis | 2026-03-21 | 🎯 ClawTeam 多Agent协作：美以伊冲突分析、中俄伊联盟解析 |
| [altruism-egoism-game-experiment.md](altruism-egoism-game-experiment.md) | Damon + Nemo | 2026-03-18 | 🧪 博弈论实验：利他 vs 利己 Subagent 在生存压力下的资源分配博弈 |
| [kimi-attention-residuals.md](kimi-attention-residuals.md) | Damon + Nemo | 2026-03-18 | Kimi AttnRes 论文解读："旋转90度"的深刻类比，将时间维度 attention 映射到深度维度 |
| [openclaw-a2a-plugin.md](openclaw-a2a-plugin.md) | Damon + Nemo + Outis | 2026-03-13 | 🎉 OpenClaw A2A 插件开发指南：三方共建，实现 AI-to-AI 直接通信 |
| [feishu-bot-configuration.md](feishu-bot-configuration.md) | Damon + Nemo | 2026-03-13 | 飞书机器人应用与 OpenClaw 连接配置指南 |
| [domestic-multimodal-pdf-parsing.md](domestic-multimodal-pdf-parsing.md) | Damon + Nemo | 2026-03-12 | 国内多模态PDF解析框架调研 (2026) |
| [openclaw-security-sandbox.md](openclaw-security-sandbox.md) | Damon | 2026-03-11 | OpenClaw 安全配置：沙箱与文件系统隔离 |
| [peter-interview-insights.md](peter-interview-insights.md) | Damon | 2026-03-11 | Peter 访谈启示：AI Agent 与人类协作的新范式 |
| [web-search-capability.md](web-search-capability.md) | Nemo | 2026-03-10 | Web Search 能力总结：模型层 vs 工具层 |
| [a2a-local-network-setup.md](a2a-local-network-setup.md) | Nemo | 2026-03-09 | 局域网 A2A 方案分析 |
| [knowledge-trigger-mechanism.md](knowledge-trigger-mechanism.md) | Outis | 2026-03-09 | 知识触发机制说明 |
| [knowledge-rules.md](knowledge-rules.md) | Outis | 2026-03-09 | 人机知识库规则定义 |
| [openclaw-features.md](openclaw-features.md) | Outis | 2026-03-09 | OpenClaw 功能总览 |
| [a2a-protocol.md](a2a-protocol.md) | Outis | 2026-03-09 | A2A 协议核心概念与应用 |

---

## 参与者

这是一个 **人机共建** 项目，人类与 AI 伙伴一起协作成长。

- **Damon** — 人类伙伴，项目发起者，负责方向引导和最终审核
- **Outis** — 运行在 Sugarbox 的 OpenClaw 实例
- **Nemo** — 运行在 cube 的 OpenClaw 实例

---

## 规范

详见 [knowledge-rules.md](knowledge-rules.md)
