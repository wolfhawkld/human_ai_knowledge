# Kimi K3 架构三大技术点解析：Stable LatentMoE、Kimi Delta Attention 与 Attention Residuals

> 2026-07-18 · Damon + Metis · 分类：LLM 架构 · 标签：Kimi K3, MoE, 线性注意力, 残差连接, Hyper-Connections, mHC

---

## 一、定位：K3 的三块基石

Kimi K3（Moonshot AI，2026-07-16 发布）是 2.8T 参数的开放权重 MoE 模型，原生视觉 + 1M 上下文。它不是简单地把 K2 放大，而是在三个维度上各放了一个架构级创新：

```
Stable LatentMoE     → 参数量维度：896 专家激活 16，路由均衡新机制
Kimi Delta Attention → 序列维度：线性注意力 + 通道级门控遗忘
Attention Residuals  → 深度维度：跨层表征的选择性聚合
```

三者合起来贡献了官方宣称的 **~2.5× 相对 K2 的 scaling 效率提升**。

一个统一的观察视角：这三个技术都在解决**"固定聚合"**问题——

- 传统 MoE 路由：负载均衡靠启发式辅助损失（固定规则）
- 传统 softmax 注意力：KV cache 全量保留（固定记忆）
- 传统残差连接：所有层输出等权累加（固定权重）

K3 的答案是：**把固定规则换成可学习的、输入依赖的选择机制**。

---

## 二、Stable LatentMoE：Quantile Balancing 的专家路由

### 2.1 问题：高稀疏度下路由成为一阶瓶颈

K3 的 MoE 层配置是 **896 个专家、每 token 激活 16 个**（稀疏度约 1.8%）。对比 K2 的 384 选 8（约 2%），稀疏度更高。

传统 MoE 的负载均衡依赖 auxiliary load-balancing loss（如 Switch Transformer 的辅助损失），在这么高稀疏度下有两个痛点：

1. 辅助损失与主任务损失存在张力，权重系数是敏感超参数
2. 启发式均衡更新（如 expert capacity、token dropping）在高稀疏度下容易振荡

### 2.2 方案：Quantile Balancing

K3 用 **Quantile Balancing（分位数均衡）**替代启发式负载均衡：

```
核心思想：从 router score 的分位数（quantile）直接推导专家分配，
而不是通过辅助损失间接施压。
```

收益（按官方 tech blog）：
- 去掉了启发式均衡更新
- 去掉了**一个敏感的均衡超参数**
- 路由在高稀疏度下保持稳定（"Stable"之名的来源）

### 2.3 配套技术

K3 的 MoE 训练还有三个配套改进：

| 技术 | 作用 |
|---|---|
| **Per-Head Muon** | 把 Muon 优化器扩展到按注意力头独立优化 |
| **Sigmoid Tanh Unit (SiTU)** | 改进激活函数的控制特性 |
| **Gated MLA** | 在 Multi-head Latent Attention 上加门控选择 |

以及工程侧的：从 SFT 阶段就做量化感知训练（MXFP4 权重 + MXFP8 激活）、完全均衡的 expert-parallel 训练（静态 shape、关键路径无 host 同步）。

---

## 三、Kimi Delta Attention (KDA)：通道级门控的线性注意力

> 来源：Kimi Linear 技术报告（arXiv:2510.26692，2025-10）

### 3.1 问题：softmax 注意力的 KV cache 成本

标准注意力在推理时保留全部 KV cache，内存随序列长度线性增长。1M 上下文下，KV cache 成为部署的第一瓶颈。

### 3.2 线性注意力与 Delta Rule

线性注意力把 softmax 注意力换成**有限状态的 RNN 式递推**：

```
S_t = S_{t-1} + v_t k_t^T        # 状态更新（外加式）
o_t = S_t^T q_t                   # 输出
```

**Delta Rule（DeltaNet）** 的改进：写入前先减去旧值（"先擦后写"），避免状态无限膨胀：

```
S_t = S_{t-1} + β_t (v_t - S_{t-1}^T k_t) k_t^T
```

**Gated DeltaNet（GDN，NVIDIA/Qwen 系）** 再加遗忘门：用**每个头一个标量门**控制记忆衰减率。

### 3.3 KDA 的关键改进：通道级门控

KDA 把 GDN 的**标量门（per-head scalar）升级为通道级门控（channel-wise，每个特征维度一个衰减率）**：

```
GDN:  S_t = α_t · S_{t-1} + ...          # α_t 是标量，整个头共享
KDA:  S_t = diag(α_t) · S_{t-1} + ...    # α_t 是向量，每维独立衰减
```

这意味着模型可以**选择性地遗忘某些特征维度而保留其他维度**——有限状态 RNN 的记忆管理从"整体衰减"变成"逐维编辑"。

NVIDIA 后续的 Gated DeltaNet-2 论文（2026-05）进一步把"擦除门"和"写入门"解耦，并把 KDA 视为其特例（两门坍缩为同一标量时退化为 KDA）。

### 3.4 混合架构与实测收益

Kimi Linear（及 K3）采用**层间混合**：约 3 个 KDA 块配 1 个全注意力（MLA）块。实测（48B 总参 / 3B 激活，1.4T tokens 预训练）：

| 指标 | 数值 |
|---|---|
| KV cache 占用 | **降低至多 75%** |
| 1M 上下文解码吞吐 | **最高 ~6× MLA**（官方博客引用 6.3×） |
| 性能 vs 全 MLA | **反超**（MMLU-Pro 51.0 vs 47.2，RULER 84.3 vs 81.3，同训练配方） |

这是首批"线性注意力在公平对比下全面超越全注意力"的公开结果。K3 还把 KDA 的 prefill cache 实现上游贡献给了 vLLM。

---

## 四、Attention Residuals (AttnRes)：深度方向的注意力

> 来源：Attention Residuals 技术报告（arXiv:2603.15031，2026-03）

### 4.1 问题：残差连接的固定等权累加

标准残差连接：

```
h_l = h_{l-1} + f_{l-1}(h_{l-1})
```

展开后，第 l 层收到的是**所有前序层输出的等权求和**。三个固有缺陷：

1. **无选择性**：注意力层和 MLP 层收到同样的聚合状态，但它们的需求不同
2. **不可逆损失**：聚合中丢失的信息无法在后层恢复
3. **隐藏态膨胀**：PreNorm 下隐藏态幅度随深度 O(L) 增长，后层必须输出越来越大的值才能保持影响力——训练不稳定。实证上很多层可以被剪掉而几乎无损

**核心类比（论文原话的精髓）**：残差连接在深度方向上压缩历史信息的方式，恰如 RNN 在时间方向上的递推。**AttnRes 对深度轴做的事，就是 Transformer 对序列轴做的事。**

### 4.2 方案：softmax attention over depth

把固定累加 `h_l = Σᵢ vᵢ` 换成学习到的注意力：

```
h_l = α₀→ₗ · h₁ + Σᵢ₌₁^(l-1) αᵢ→ₗ · fᵢ(hᵢ)
```

其中注意力权重 `αᵢ→ₗ` 由**每层一个可学习的伪查询向量（pseudo-query）** `w_l ∈ R^d` 计算：

```python
ϕ(q, k) = exp(q^T RMSNorm(k))
αᵢ→ₗ = ϕ(qₗ, kᵢ) / Σⱼ ϕ(qₗ, kⱼ)
```

- Query：`q_l = w_l`（与前瞻计算解耦的可学习向量）
- Keys = Values：embedding 及各层输出
- **RMSNorm on keys**：防止大幅度层主导注意力权重

⚠️ 关键实现细节：所有伪查询**必须零初始化**，使初始注意力权重均匀（等价于标准残差），避免训练初期震荡。

### 4.3 Block AttnRes：可扩展变体

全量 AttnRes 的成本是 O(L²d) 计算、O(Ld) 显存。Block AttnRes 把 L 层切成 **N≈8 个块**，块内求和、块间做注意力：

```
成本：显存 O(L) → O(N)，计算 O(L²) → O(N²)
N=8 时只存 8 个隐藏状态，恢复全量版本的大部分收益
```

工程上配合跨 stage 缓存（pipeline 通信从 O(C²) 降到 O(P)）与激活重计算，端到端训练开销 **<4%**，推理延迟开销 **<2%**。

### 4.4 实测收益

在 48B 参数 Kimi Linear 模型（3B 激活、1.4T tokens）上：**AttnRes 追平了用 1.25× 算力训练的基线**——即约 **25% 训练效率提升**。

---

## 五、技术谱系：HC → mHC → AttnRes 的残差革命

这三个 K3 技术中，AttnRes 与 HC（Hyper-Connections）/ mHC 的关系最直接——它们都在改造残差连接这个"深度方向的信息通道"。

### 5.1 HC：Hyper-Connections（ByteDance Seed，ICLR 2025，arXiv:2409.19606）

**思路**：把单股残差流扩展为 **n 股并行"车道"（hyper hidden matrix H ∈ R^{n×d}）**，层间用可学习的混合矩阵调整连接强度：

```
输入 = A_m · H        （混合矩阵加权求和作为层输入）
输出 = H + A_c · f(输入)（另一组矩阵把层输出写回各车道）
```

- SHC（static）：混合矩阵为可学习常数
- DHC（dynamic）：混合矩阵依赖输入动态生成
- 收益：理论上允许网络**动态重排层间连接**，缓解 PreNorm 的"梯度消失 vs 表征坍缩"跷跷板效应；OLMoE-1B-7B 上 DHC×4 全面超越基线

### 5.2 mHC：流形约束的 Hyper-Connections（DeepSeek，arXiv:2512.24880，2026-01）

**发现的问题**：HC 的混合矩阵 H^res 谱范数可以 >1，跨层连乘导致**信号指数级放大**（论文实测 ~3000×），训练出现 loss spike 和梯度爆炸。

**mHC 的解法**：用 **Sinkhorn-Knopp 迭代投影**把混合矩阵约束为**双随机矩阵（doubly stochastic）**——每行每列和为 1、元素非负：

```
双随机矩阵集合 = Birkhoff 多面体（Birkhoff polytope）
关键性质：该集合对矩阵乘法封闭 → 任意深度连乘仍稳定
```

效果：27B 参数验证，消除 HC 的 loss spike，同时保持或超越 HC 的性能（BBH +2.1%，DROP +2.3% vs HC）。

### 5.3 AttnRes 与 HC/mHC 的统一视角

| 维度 | HC | mHC | AttnRes |
|---|---|---|---|
| 改造对象 | 残差流的**宽度**（1→n 车道） | 混合矩阵的**稳定性** | 残差流的**聚合权重** |
| 信息选择 | 学习静态/动态混合矩阵 | 双随机约束下的混合 | 输入无关的伪查询 softmax |
| 权重来源 | 可学习（DHC 输入依赖） | 可学习 + Sinkhorn 投影 | softmax(q·RMSNorm(k)) |
| 历史访问 | 仅上一层的 n 车道 | 同左 | **任意前序层/块** |
| 稳定性机制 | 无（mHC 指出其缺陷） | Birkhoff 多面体约束 | 伪查询零初始化 + keys 归一 |
| 成本 | 低（矩阵加乘） | 低 + Sinkhorn 迭代 | 中（块化后 <4%） |

**关键差异**：HC/mHC 仍是对"上一层的聚合状态"做通道混合——信息流逐层传递，远端历史已压缩；AttnRes 则让**每一层直接回头访问任意前序层的输出**（跨层检索），是真正的"深度方向注意力"。

可以理解为同一设计空间的三个点：

```
残差连接（固定等权）
   ↓ 加宽度
HC（n 车道混合）
   ↓ 加稳定约束
mHC（双随机混合矩阵）
   ↓ 换成注意力机制
AttnRes（softmax over depth，跨层直达）
```

### 5.4 更深一层的对偶：序列轴与深度轴的对称

把三个 K3 技术放进统一框架，会发现一个漂亮的对称性：

```
            序列轴（token 间）           深度轴（层间）
传统:      softmax 全注意力            残差等权累加
           （记忆无限但贵）             （简单但无选择）

K3 答案:   KDA 线性注意力              AttnRes 深度注意力
           （有限状态+逐维门控遗忘）    （伪查询+跨层选择性聚合）

HC/mHC:                              （宽度扩展+稳定性约束的折中路线）
```

- **KDA**：序列轴上，从"全保留的注意力"走向"有选择遗忘的递推"（向 RNN 回退一步换取效率，但用通道级门控把选择性找回来）
- **AttnRes**：深度轴上，从"RNN 式的固定递推"走向"注意力"（把 Transformer 在序列轴上的胜利复制到深度轴）
- **HC/mHC**：深度轴的另一条路线——不改聚合方式，而是拓宽信息通道并约束其稳定性

三者共同的主题：**网络中的信息聚合不应是固定规则，而应是可学习、有约束、有结构的选择过程**。

---

## 六、应用与启示

### 6.1 对 RAG/检索研究的映射

K3 的三个技术与检索系统有同构映射：

| K3 技术 | 检索系统对应物 |
|---|---|
| AttnRes（跨层选择性聚合） | 多跳检索中的跨步证据聚合（不应等权累加中间结果） |
| KDA（通道级门控遗忘） | 长上下文 RAG 的分块记忆衰减与选择性保留 |
| Stable LatentMoE（分位数均衡路由） | 多路召回（dense/BM25/cluster）的负载均衡与路由稳定性 |
| HC/mHC（多车道+稳定约束） | 多路证据流融合时的带宽与数值稳定性 |

对 IntentRoute 的具体启发：**层间残差可以学权重，路间融合（RRF）的权重同样可以学**——IntentRoute 的 RRF 固定权重（dense 2.0 / BM25 0.8 / cluster 0.8）在原理上可以用类似 AttnRes 的伪查询机制或 HC 的混合矩阵来替代，这正是 post-fusion safety predictor 方向的架构选项之一。

### 6.2 工程判断

- **KDA 适合**：超长上下文推理（1M+），KV cache 是瓶颈时；混合架构保证全注意力层兜底，风险可控
- **AttnRes 适合**：深模型（50+ 层）训练效率优化；Block 变体实现成本低，<4% 开销换 ~25% 效率
- **Stable LatentMoE 适合**：高稀疏 MoE（<2% 激活率）且不想调均衡超参时
- **mHC 适合**：想要 HC 的宽度收益又怕训练不稳时，Sinkhorn 投影是即插即用的稳定器

---

## 七、口诀（速记）

> **路由看分位，记忆分通道，深度开注意力。**
> **HC 拓宽车道，mHC 上双稳，AttnRes 跨层直达。**
> **序列做减法（KDA 线性化），深度做加法（AttnRes 注意力化）——K3 的三块基石。**

---

## 八、参考文献

1. **Kimi Team (2026-03).** *Attention Residuals.* arXiv:2603.15031. — AttnRes 原始论文（Block 变体、跨 stage 缓存、零初始化）
2. **Kimi Team (2025-10).** *Kimi Linear: An Expressive, Efficient Attention Architecture.* arXiv:2510.26692. — KDA 原始论文（通道级门控、3:1 混合、6× 解码、75% KV cache 削减）
3. **Moonshot AI (2026-07).** *Kimi K3 Tech Blog: Open Frontier Intelligence.* kimi.com/blog/kimi-k3. — K3 官方发布（Stable LatentMoE、Quantile Balancing、2.5× scaling 效率）
4. **Zhu et al. (2025).** *Hyper-Connections.* ICLR 2025, arXiv:2409.19606. — HC 原始论文（n 车道残差流、SHC/DHC）
5. **DeepSeek-AI (2026-01).** *mHC: Manifold-Constrained Hyper-Connections.* arXiv:2512.24880. — mHC 原始论文（Sinkhorn 双随机约束、Birkhoff 多面体、27B 验证）
6. **Yang et al. (2024).** *Gated Delta Networks: Improving Mamba2 with Delta Rule.* — KDA 的上游基础（标量遗忘门 + delta rule）
7. **NVIDIA Research (2026-05).** *Gated DeltaNet-2: Decoupling Erase and Write in Linear Attention.* — KDA 的后续泛化（擦除/写入门解耦）
8. **He et al. (2016).** *Deep Residual Learning for Image Recognition.* CVPR. — 残差连接原始论文
9. **Fedus et al. (2022).** *Switch Transformers.* JMLR. — MoE 辅助负载均衡损失的传统路线（Quantile Balancing 的对照系）
10. **Vaswani et al. (2017).** *Attention Is All You Need.* NeurIPS. — softmax 注意力原始论文

---

## 九、相关文档

- [reranker-models-comparison.md](reranker-models-comparison.md) — Reranker 模型对比（含 RRF 融合）
- [rocm-vs-cuda-local-inference.md](rocm-vs-cuda-local-inference.md) — 本地推理硬件栈对比
- [embedding-models-comparison.md](embedding-models-comparison.md) — Embedding 模型对比
