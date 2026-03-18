# Kimi Attention Residuals 论文解读

> **来源**: Kimi Team 论文《Attention Residuals》(arxiv 2603.15031)  
> **生成者**: Damon + Nemo  
> **日期**: 2026-03-18  
> **链接**: [arxiv](https://arxiv.org/abs/2603.15031) | [GitHub](https://github.com/MoonshotAI/Attention-Residuals)

---

## 核心问题

现代 LLM 普遍采用 **PreNorm + 残差连接**，但存在两个问题：

1. **Hidden-state 无界增长** — 随深度增加，magnitude 持续膨胀
2. **逐层稀释** — 早期层的贡献被均匀稀释，深层时几乎消失

---

## 解决方案：AttnRes

将**固定权重的残差累加**替换为**学习权重的深度维度 attention**：

$$\mathbf{h}_l = \sum_{i=0}^{l-1} \alpha_{i \to l} \cdot \mathbf{v}_i$$

其中权重 $\alpha_{i \to l}$ 通过 learned pseudo-query 计算，是 **content-aware** 的。

---

## "旋转90度"的深刻类比

> "An LSTM is a ResNet rotated 90 degrees. It turns out attention can be rotated 90 degrees too — yielding a natural generalization of residual connections."  
> — Jürgen Schmidhuber / 论文作者

### 理解这个类比

传统 Transformer 有两个维度：

| 维度 | 方向 | 机制 |
|------|------|------|
| **时间维度** | 横向（Token sequence） | Self-attention（可学习权重） |
| **深度维度** | 纵向（Layer depth） | 固定残差累加（权重=1） |

**AttnRes 做的事情**：把时间维度上成功的 **attention 机制**，"旋转90度"应用到深度维度。

```
时间维度 attention（传统）：
Token t₁ ──●──●──●──●──  ← Self-attention
          │  │  │  │
Token t₂ ──●──●──●──●──
          │  │  │  │
Token t₃ ──●──●──●──●──
          ↓  ↓  ↓  ↓
         L₁ L₂ L₃ L₄

深度维度 attention（AttnRes）：
       L₁   L₂   L₃   L₄
       ↓    ↓    ↓    ↓
Token: ● ←──● ←──● ←──●  ← Depth-attention!
       ↑    ↑    ↑    ↑
       └────┴────┴────┘
         每层可以 attend to 所有之前层
```

### 数学上的对称美

**时间维度 attention**：
$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d}}\right) V$$

**深度维度 attention（AttnRes）**：
$$\mathbf{h}_l = \sum_{i=0}^{l-1} \alpha_{i \to l} \cdot \mathbf{v}_i$$

Query = learned pseudo-query $\mathbf{w}_l$，Key/Value = 之前层的输出。

---

## Block AttnRes：工程优化

**Full AttnRes** 内存开销 O(Ld)，不实用。

**Block AttnRes**：
- 将 L 层分成 N 个 block
- Block 内：标准残差累加
- Block 间：attention over block representations
- 内存从 O(Ld) 降到 O(Nd)

```python
def block_attn_res(blocks, partial_block, proj, norm):
    V = torch.stack(blocks + [partial_block])  # [N+1, B, T, D]
    K = norm(V)
    logits = torch.einsum('d, n b t d -> n b t', proj.weight.squeeze(), K)
    h = torch.einsum('n b t, n b t d -> b t d', logits.softmax(0), V)
    return h
```

---

## 实验结果

| Benchmark | Baseline | AttnRes | 提升 |
|-----------|----------|---------|------|
| GPQA-Diamond | 36.9 | **44.4** | +7.5 |
| MMLU | 73.5 | 74.6 | +1.1 |
| HumanEval | 59.1 | **62.2** | +3.1 |
| Math | 53.5 | **57.1** | +3.6 |

**关键发现**：多步推理（GPQA）和代码生成收益最大。

---

## 三个核心贡献

1. **解决 PreNorm 稀释问题** — 让每层主动选择需要的历史信息
2. **Magnitude 有界** — Softmax 归一化保证 hidden-state 不会无限增长
3. **梯度分布更均匀** — 梯度可以"跳跃"传回任意层

---

## 一句话总结

> AttnRes 将时间维度的 attention 机制"旋转90度"应用到深度维度，把固定权重的残差累加泛化为学习权重的选择性聚合，让每层可以"回头看"并选择性地保留之前任意层的信息。

---

## 相关资源

- [论文 arxiv](https://arxiv.org/abs/2603.15031)
- [GitHub 仓库](https://github.com/MoonshotAI/Attention-Residuals)
- [Schmidhuber 关于 LSTM/ResNet 类比的讨论](https://twitter.com/SchmidhuberAI)