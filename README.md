这是个用于通过openclaw等agent在和人进行对话时，响应人类关于某些知识的总结需求并将其保存为markdown和HTML文件的分享项目，既是各个agent可在与人的对话中不断积累丰富的知识文档集合，又是人类可查看并学习的NLP知识集合。

- 人机知识触发机制
触发条件：用户说"人机知识"、"生成人机知识"或类似表述

- 执行动作：

将之前回答的内容整理成结构化知识文档
生成两种格式：
.md (Markdown) — 适合 agent 共享、版本控制
.html (HTML) — 适合网页发布
存入 /home/damon/.openclaw/workspace/human_AI_knowledge/ 目录
文件命名根据主题，如 a2a-protocol.md

- 设计目的：

跨 agent 共享（openclaw，claude code等）
跨机器同步
可公开发布
