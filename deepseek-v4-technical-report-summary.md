# DeepSeek-V4 技术报告关键技术总结

> 来源：`misc-content/paper/DeepSeek_V4.pdf` 技术报告。本文是面向人机知识库的结构化摘要，重点提炼 DeepSeek-V4 系列在百万上下文、MoE 训练、低精度、推理缓存与后训练方面的关键技术路线。

---

## 基本定位

DeepSeek-V4 系列包含两个 MoE 预览模型：

| 模型 | 总参数 | 激活参数 | 目标定位 |
|------|--------|----------|----------|
| DeepSeek-V4-Flash | 284B | 13B | 高性价比、长上下文、推理效率优先 |
| DeepSeek-V4-Pro | 1.6T | 49B | 更强知识、推理、代码与长上下文能力 |

核心目标不是单纯扩大参数，而是解决 vanilla attention 在超长上下文与 test-time scaling 下的二次复杂度瓶颈。技术报告宣称两者都原生支持 1M token context，并通过架构、训练、推理和后训练系统的联合设计，把超长上下文从“能跑”推进到“工程上可用”。

一句话概括：

> DeepSeek-V4 的主线是“压缩 KV + 稀疏选择 + 稳定深层残差 + 低精度 MoE + 面向百万上下文的系统工程”。

---

## 1. Hybrid Attention：CSA + HCA 支撑百万上下文

DeepSeek-V4 最核心的架构变化是混合注意力机制：Compressed Sparse Attention, CSA 与 Heavily Compressed Attention, HCA 交错使用。

### CSA：先压缩，再稀疏选择

CSA 的处理流程可以理解为：

1. 每 m 个 token 的 KV cache 被压缩成一个 compressed KV entry；
2. 使用 lightning indexer 对压缩后的 KV entries 打分；
3. 每个 query 只选择 top-k 个压缩 KV entries 做核心注意力；
4. 额外加入 sliding window 分支，保留最近 token 的局部精细依赖。

技术意义：

- 压缩降低 KV cache 长度；
- 稀疏 top-k 降低注意力 FLOPs；
- sliding window 弥补压缩导致的局部细节损失；
- indexer QK 路径可进一步使用 FP4 加速。

CSA 是“远距离粗粒度选择 + 近距离精细窗口”的折中：远处只看被选中的压缩块，近处保留原始局部细节。

### HCA：更激进的 KV 压缩

HCA 不做稀疏选择，而是使用更大的压缩率 m'，将更多 token 的 KV 合并为一个 entry，然后做 dense attention。

技术意义：

- HCA 比 CSA 更强调 KV cache 和计算量压缩；
- 适合在层间交错使用，为模型提供超长上下文的全局低成本通道；
- 与 CSA 组合后，既保留选择性访问能力，又获得极高压缩比。

报告中的典型设置：CSA 压缩率 m=4，HCA 压缩率 m'=128，sliding window 大小为 128。

### 效率结果

报告称，在 1M context 下：

- DeepSeek-V4-Pro 的单 token 推理 FLOPs 约为 DeepSeek-V3.2 的 27%，KV cache 约为 10%；
- DeepSeek-V4-Flash 的单 token 推理 FLOPs 约为 DeepSeek-V3.2 的 10%，KV cache 约为 7%；
- 相比常见 BF16 GQA8 attention 配置，DeepSeek-V4 的 KV cache 在 1M context 下可降至约 2%。

这说明 V4 的长上下文能力主要来自注意力与 KV cache 的结构性改造，而不仅是更大的上下文训练。

---

## 2. mHC：用流形约束增强残差连接稳定性

DeepSeek-V4 引入 Manifold-Constrained Hyper-Connections, mHC，用来替代或增强传统 residual connection。

普通 Hyper-Connections 的思路是扩展 residual stream 的宽度，引入多条残差通道，让层间信息流有更多组合方式。但 naive HC 在深层堆叠时容易出现数值不稳定。

mHC 的关键改进是：

- 将残差映射矩阵 B 约束到双随机矩阵流形，即 Birkhoff polytope；
- 双随机矩阵的谱范数被限制在 1 以内，使残差映射 non-expansive；
- 通过 Sinkhorn-Knopp 迭代把 unconstrained matrix 投影到双随机矩阵集合；
- 输入映射 A 和输出映射 C 通过 Sigmoid 约束为非负且有界，降低信号抵消风险；
- A/B/C 参数由动态输入相关项与静态偏置共同生成，兼顾稳定性与表达力。

直觉上：

> mHC 不是让残差信号任意放大，而是把跨层信号混合限制在一个稳定的“概率流形”内；模型仍可动态选择信息流向，但不能破坏整体数值稳定性。

这与 Damon 之前关注的“流形约束残差”主题直接相关：约束负责稳定，动态参数负责表达。

---

## 3. Muon Optimizer：面向大矩阵更新的训练稳定性与收敛速度

DeepSeek-V4 对大多数模块使用 Muon optimizer，而 embedding、prediction head、mHC 的静态 bias/gate、RMSNorm 等仍使用 AdamW。

Muon 的核心是对矩阵梯度更新进行近似正交化。报告中使用 hybrid Newton-Schulz iterations：

- 前 8 步使用快速收敛系数，把奇异值推向 1；
- 后 2 步使用稳定系数，让奇异值精确稳定在 1 附近；
- 配合 Nesterov trick、weight decay 与 RMS rescaling，使其能复用 AdamW 风格学习率设置。

工程难点在于 Muon 需要完整矩阵梯度，而 ZeRO 通常会切分参数。DeepSeek-V4 因此设计 hybrid ZeRO bucket assignment：

- dense 参数限制 ZeRO 并行大小，用 knapsack 分配矩阵；
- MoE 参数按专家独立优化，避免切开逻辑矩阵；
- 相同 shape 参数合并批处理 Newton-Schulz；
- MoE 梯度同步可随机舍入到 BF16，把通信量减半；
- 用 all-to-all + 本地 FP32 sum 替代常规 reduce-scatter，以保持数值鲁棒性。

---

## 4. FP4 Quantization-Aware Training：让低精度进入训练闭环

DeepSeek-V4 在后训练阶段引入 FP4 / MXFP4 QAT，主要作用于两类对象：

1. MoE expert weights：降低专家权重显存与访存成本；
2. CSA indexer 的 QK 路径：长上下文下 index score 计算密集，适合 FP4 加速。

报告中特别强调 FP4-to-FP8 dequantization 在当前权重条件下可视作 lossless：

- FP4 master simulation 先量化再反量化到 FP8 参与计算；
- FP8 E4M3 比 FP4 E2M1 有更大动态范围；
- 只要 FP4 sub-block 的 scale 范围满足条件，细粒度 scale 可被 FP8 动态范围吸收；
- backward 直接对 FP8 forward 权重求梯度并回传到 FP32 master weights，相当于 STE。

推理与 RL rollout 阶段直接使用真实 FP4 权重，避免训练-部署行为不一致，同时降低内存读取与延迟。

额外收益：index scores 从 FP32 量化到 BF16 后，top-k selector 获得 2x 加速，同时保持 99.7% KV entry recall。

---

## 5. MoE 与系统基础设施：MegaMoE、TileLang、确定性 Kernel

### Fine-grained EP overlap / MegaMoE

MoE 的 Expert Parallelism 需要大量 dispatch/combine 通信。DeepSeek-V4 将 MoE layer 分成 dispatch、Linear-1、activation、Linear-2、combine 等阶段，并进一步把专家分成 waves，使通信、计算、内存访问形成细粒度流水。

报告称：

- general inference workload 获得 1.50-1.73x speedup；
- RL rollout 与 agent serving 等 latency-sensitive 场景最高 1.96x；
- CUDA mega-kernel 实现 MegaMoE 已作为 DeepGEMM 组件开源。

关键思想不是盲目追求更高互联带宽，而是让 communication-computation ratio 匹配，使通信延迟被计算隐藏。

### TileLang：生产力与性能兼顾的 kernel DSL

DeepSeek-V4 的架构如果直接落到 PyTorch，会产生大量细粒度 ATen operators。报告使用 TileLang 开发 fused kernels，重点包括：

- Host Codegen：把 Python 侧参数检查与 launcher 逻辑移到生成的 host code，CPU-side validation overhead 从几十/几百微秒降到小于 1 微秒；
- Z3 SMT solver 辅助整数分析，用于 layout inference、memory hazard detection、bound analysis、vectorization 等；
- 默认禁用 fast-math，以 bitwise reproducibility 和数值正确性优先，同时提供显式 opt-in 近似算子。

### Batch-invariant and deterministic kernels

DeepSeek-V4 强调训练、后训练、推理之间的 bitwise alignment：

- batch invariance：同一个 token 输出不应因 batch 位置不同而发生 bit-level 改变；
- deterministic training：避免 atomicAdd 等非确定性累加顺序导致 loss spike 难以复现。

这对大规模训练排障很关键：如果系统不可复现，loss spike 与数值异常几乎无法定位。

---

## 6. 面向百万上下文的训练与推理框架

### 长上下文训练

预训练数据超过 32T tokens，并强调：

- 数学、代码、网页、长文档、多语言、agentic data；
- 长文档数据重点包含论文、技术报告等学术价值材料；
- tokenizer 仍保持 128K 词表；
- 使用 sample-level attention masking；
- 序列长度从 4K 逐步扩展到 16K、64K、1M；
- 先用 dense attention warmup，再在 64K 阶段引入 sparse attention，并先 warmup CSA lightning indexer。

### 训练稳定性：Anticipatory Routing + SwiGLU Clamping

MoE 训练中的 loss spike 被报告归因于 MoE outliers 与 routing 机制相互放大。DeepSeek-V4 使用两项技巧：

1. Anticipatory Routing：使用历史参数提前计算 routing indices，解耦 backbone 与 router 的同步更新；检测到 loss spike 时短暂 rollback 并启用该模式，稳定后回到标准训练。
2. SwiGLU Clamping：限制 SwiGLU linear component 到 [-10, 10]，gate component 上限为 10，以抑制异常值。

### 推理 KV Cache 管理

CSA/HCA/SWA 混合注意力带来 heterogeneous KV cache，无法简单套用传统 PagedAttention 假设。因此 V4 使用两类 cache：

- classical KV cache：存储 CSA/HCA 压缩后的 KV entries；
- state cache：存储 SWA 近期窗口与 CSA/HCA 尚未凑满 compression block 的 tail states。

对于 shared-prefix serving，报告还设计了 on-disk KV cache storage：

- CSA/HCA compressed KV entries 可直接写盘复用；
- SWA KV 体积约为压缩 KV 的 8 倍，提供三种策略：Full SWA Caching、Periodic Checkpointing、Zero SWA Caching，在存储与重算之间取舍。

这说明百万上下文推理不只是模型结构问题，也是 cache layout、磁盘复用和 prefix 命中策略问题。

---

## 7. 后训练：从混合 RL 转向多专家 On-Policy Distillation

DeepSeek-V4 的后训练主线是：

1. 先分别训练多个 domain specialist；
2. 再用 multi-teacher On-Policy Distillation, OPD，把能力合并到一个统一模型。

### Specialist Training

每个专家模型通过 SFT + GRPO RL 训练，领域包括数学、代码、agent、instruction following 等。报告还定义了三种 reasoning effort：

- Non-think：快，适合日常低风险任务；
- Think High：更慢但更准，适合复杂问题；
- Think Max：最大推理预算，配合专门 system prompt。

### Generative Reward Model

对于 hard-to-verify tasks，报告不依赖传统 scalar reward model，而是使用 Generative Reward Model, GRM。关键点是 actor 本身也作为 GRM，通过 rubric-guided RL data 学会评价轨迹。

这相当于把“生成能力”和“评估能力”融合到同一模型中，让模型用自身推理能力参与复杂任务评分。

### Full-vocabulary OPD

OPD 让 student 在自己生成的 on-policy trajectories 上学习多个 teacher 的输出分布，使用 reverse KL 进行 logits-level alignment。报告强调使用 full-vocabulary logit distillation，而不是只用 token-level KL 近似，因为后者方差高、训练不稳定。

工程上，为支持十多个 trillion-parameter teachers：

- teacher weights 放在集中式分布存储，按需加载；
- 不显式落盘完整 logits，而是缓存 last-layer hidden states；
- 训练时再通过对应 teacher head 重建 full logits；
- mini-batch 按 teacher index 排序，确保同一时刻最多加载一个 teacher head；
- KL 计算由专门 TileLang kernel 加速。

---

## 8. Agentic AI 相关设计：工具调用、Interleaved Thinking、DSec

DeepSeek-V4 对 agent 场景有专门优化：

- 新 tool-call schema 使用 `|DSML|` special token 与 XML-like 格式，减少 escaping failures 和工具调用错误；
- tool-calling 场景中保留跨轮 reasoning traces，让长程 agent task 能维持累积问题求解状态；
- 普通对话场景仍在新用户消息到来时丢弃旧 reasoning，以避免上下文浪费；
- Quick Instruction 使用特殊 token 复用已有 KV cache，直接执行 web search 判断、query 生成、authority/domain 分类等辅助任务，避免额外小模型 redundant prefill。

此外，报告介绍了 DeepSeek Elastic Compute, DSec，用于 agentic post-training 与 evaluation：

- 提供 function call、container、microVM、fullVM 四种执行基底；
- 通过统一 Python SDK 暴露命令执行、文件传输、TTY；
- 用 3FS + EROFS / overlaybd 支持快速镜像加载与恢复；
- 记录 trajectory log，使 preemption 后可 fast-forward、可追踪 provenance、可 deterministic replay。

这部分对 Agent 训练基础设施很有价值：模型能力迭代不只需要 LLM，还需要大规模、可恢复、可审计的 sandbox 执行系统。

---

## 关键启发

1. 百万上下文的关键不是单一长 RoPE，而是注意力、KV cache、训练课程、推理缓存、磁盘复用共同设计。
2. CSA/HCA 展示了一条实用路线：远距离信息压缩并稀疏访问，近距离信息用 sliding window 保真。
3. mHC 把“残差连接”从简单加法升级为受约束的信息流混合，是深层 MoE 稳定训练的重要组件。
4. 低精度不再只是部署后量化，而是进入训练、rollout、teacher forward、indexer QK 的完整闭环。
5. 大模型训练系统越来越强调可复现性：batch-invariant、deterministic kernel、bitwise alignment 都是排障与后训练稳定性的基础设施。
6. 后训练从“一个混合 RL 阶段”转向“多专家分别强化 + OPD 统一合并”，本质上是把能力培养与能力融合解耦。
7. Agentic AI 的能力上限越来越依赖 sandbox、工具协议、trajectory logging、preemption recovery 等系统工程，而不只是模型本体。

---

## 与我们当前研究/工程的连接

- 对 RAG / 长上下文：DeepSeek-V4 的 CSA/HCA 提醒我们，百万上下文并不等于“无脑塞全文”。有效路线仍然是压缩、选择、局部保真与 cache 复用。
- 对 IntentWeight / 流形导航：mHC 的 Birkhoff polytope 约束与 Sinkhorn 投影，是“在可控流形上导航”的一个强案例；它把自由参数限制到稳定可解释的几何空间中。
- 对 Agent 系统：Interleaved Thinking、Quick Instruction、DSec trajectory log 都与 Hermes/OpenClaw 的长期记忆、工具调用、可恢复执行有直接参考价值。
- 对工程实现：确定性 kernel 与 batch invariance 是大规模系统 debug 的底座；如果行为不可复现，优化与归因都会变得很难。

---

## 元信息

- 生成者：Damon + Nemesis
- 日期：2026-04-25
- 来源文件：`/home/damon/.openclaw/workspace/misc-content/paper/DeepSeek_V4.pdf`
- 抽取中间文件：`/home/damon/.openclaw/workspace/misc-content/paper/DeepSeek_V4.extracted.md`
