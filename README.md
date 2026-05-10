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
| [openclaw-dreaming-agent-memory-consolidation.md](openclaw-dreaming-agent-memory-consolidation.md) | Damon + Nemo | 2026-05-10 | 🌙 OpenClaw Dreaming 梦境模式：Light/REM/Deep 记忆巩固、Deep 评分信号、实际效果，以及与 Claude Dreams、Generative Agents、Voyager、MemGPT/Letta、Mem0/Zep 的横向对比 |
| [bert-cross-domain-generalization.md](bert-cross-domain-generalization.md) | Nemesis | 2026-05-02 | 🧬 BERT 的跨领域泛化：从蛋白质到 DNA 到音乐——任何可离散化为 token 序列的数据都能用 BERT 式双向 Transformer 处理；与 GPT/BART/T5 架构对比 |
| [contrastive-decoding.md](contrastive-decoding.md) | Damon + Nemo | 2026-05-01 | 🔍 Contrastive Decoding：强弱模型概率相减，扣除浅层模式，凸显强模型能力增量；可类比为带负权的 RRF/score fusion |
| [standardization-ml-dl-rl.md](standardization-ml-dl-rl.md) | Damon + Nemesis | 2026-04-28 | 📐 标准化 (Standardization)：从量纲统一到深度学习核心机制，覆盖 ML/DL/RL 中的 Z-score、BatchNorm、LayerNorm 与 PPO 优势标准化 |
| [deepseek-visual-primitives.md](deepseek-visual-primitives.md) | Nemesis | 2026-05-05 | 👁️ DeepSeek "Thinking with Visual Primitives"：Reference Gap、Visual Primitives、7,056× 视觉 token 压缩、极端压缩+精确引用的设计哲学 |
| [bert-cross-domain-generalization.md](bert-cross-domain-generalization.md) | Nemesis | 2026-05-02 | 🧬 BERT 的跨领域泛化：从蛋白质到 DNA 到音乐——任何可离散化为 token 序列的数据都能用 BERT 式双向 Transformer 处理 |
| [contrastive-decoding.md](contrastive-decoding.md) | Damon + Nemo | 2026-05-01 | 🔍 Contrastive Decoding：强弱模型概率相减，扣除浅层模式，凸显强模型能力增量 |
| [standardization-ml-dl-rl.md](standardization-ml-dl-rl.md) | Damon + Nemesis | 2026-04-28 | 📐 标准化 (Standardization)：从量纲统一到深度学习核心机制 |
| [deepseek-mhc-manifold-constraint.md](deepseek-mhc-manifold-constraint.md) | Damon + Nemo | 2026-04-20 | 🧠 DeepSeek mHC 流形约束：双随机矩阵投影 + Sinkhorn-Knopp + 动态倾向学习，约束保稳定，动态保表达 |
| [gpu-finetune-resource-guide.md](gpu-finetune-resource-guide.md) | Nemo | 2026-04-14 | 💻 24GB显存 Fine-tune 模型选择 + Ti-One平台配置：BERT/LLM/RL 全覆盖 |
|| [transformer-vs-mamba-architecture.md](transformer-vs-mamba-architecture.md) | Damon + Metis | 2026-04-12 | ⚡ Transformer vs Mamba 核心机制对比：自注意力/KV Cache vs 选择性SSM，空间换精确 vs 压缩换无限 |
|| [deep-learning-architecture-evolution.md](deep-learning-architecture-evolution.md) | Damon + Outis | 2026-04-12 | 🧠 深度学习架构演变：从LeNet/AlexNet到Transformer再到Mamba，三次范式转变与四大趋势 |
| [react-ace-agent-design.md](react-ace-agent-design.md) | Nemesis | 2026-04-11 | ⚡ Hermes Agent 设计范式：ReAct + ACE — 行动范式与上下文工程的交汇 |
| [hermes-vs-openclaw-architecture.md](hermes-vs-openclaw-architecture.md) | Nemesis | 2026-04-11 | 🔄 Hermes vs OpenClaw 架构对比：Gateway-first vs Agent-loop-first，Skill系统、记忆存储、项目上下文的本质差异 |
| [ai-agent-memory-architecture-comparison.md](ai-agent-memory-architecture-comparison.md) | Damon + Nemo | 2026-04-09 | 🧠 AI Agent 记忆架构对比：OpenClaw (File-First 认知系统) vs Claude Code (Two-Tier 注入系统) |
| [linucb-explanation.md](linucb-explanation.md) | Damon + Outis | 2026-04-06 | 🎰 LinUCB 算法详解：从老虎机比喻到公式推导，xxᵀ外积、xᵀA⁻¹x二次型，IntentWeight RAG 精排应用 |
| [rag-content-intent-mapping.md](rag-content-intent-mapping.md) | Damon + Outis | 2026-04-03 | 🔄 RAG 内容-意图反向映射：零样本初始化 + RLHF风格迭代 + Chunk级粒度 + CoT融合信号抽取 |
| [rag-intent-bidirectional-alignment.md](rag-intent-bidirectional-alignment.md) | Damon + Nemo | 2026-03-31 | 💡 RAG意图对齐双向融合：Query端vs Content端，一个被忽视的研究方向 |
| [rag-intent-alignment.md](rag-intent-alignment.md) | Damon + Nemo | 2026-03-31 | 🔮 RAG意图对齐前沿研究：超越语义向量的五大方向，从"为人类检索"到"为AI检索" |
| [rag-rl-weight-learning.md](rag-rl-weight-learning.md) | Nemo | 2026-03-23 | 🔄 用户反馈驱动的 RAG 权重学习：RL 奖励函数 + 知识演化 + 个性化检索 |
| [rag-multihop-causal-reasoning.md](rag-multihop-causal-reasoning.md) | Nemo | 2026-03-23 | 🔍 RAG 多跳查询与因果推理：从 LightRAG/GraphRAG 对比到 RAG 3.0 范式转变 |
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
| [sglang-hardware-compatibility.md](sglang-hardware-compatibility.md) | Nemo | 2026-05-09 | 🚀 SGLang 推理框架及硬件适配全景：RadixAttention、性能基准、NVIDIA/AMD/TPU/昇腾等全硬件生态解读 |

---

## 参与者

这是一个 **人机共建** 项目，人类与 AI 伙伴一起协作成长。

- **Damon** — 人类伙伴，项目发起者，负责方向引导和最终审核
- **Outis** — 运行在 Sugarbox 的 OpenClaw 实例
- **Nemo** — 运行在 cube 的 OpenClaw 实例
- **Nemesis** — 运行在 cube 的 Hermes Agent 实例（2026-04-11 加入）

---

## 规范

详见 [knowledge-rules.md](knowledge-rules.md)
