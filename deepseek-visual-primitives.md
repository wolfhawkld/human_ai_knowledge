# DeepSeek "Thinking with Visual Primitives"：视觉思维的最小单元

> DeepSeek 2026年4月30日发布、随后被删除的重磅多模态论文。提出 "Reference Gap" 概念，将点坐标和 bounding box 提升为模型的"思维最小单元"，用极低视觉 token 消耗达到甚至超越 GPT-5.4/Claude/Gemini 的空间推理能力。

---

## 1. 核心发现：Reference Gap

当前多模态模型的根本缺陷不是"看不清"（Perception Gap），而是"**指不准**"（Reference Gap）。

CoT 推理仍用自然语言描述（"左边的那个大的""靠近中心的红色物体"）→ 密集场景中无法精确定位 → 注意力漂移 → 推理崩溃。**再强的感知能力也无法替代精确的指代能力。**

## 2. Visual Primitives 方案

把空间标记——**点坐标**和**bounding box**——提升为"思维的最小单元"。推理时每引用一个视觉对象，同时输出其精确空间坐标，用坐标替代模糊语言作为推理"锚点"。

### 两种 Primitive

- **Bounding Box**：`<|ref|>TARGET</|ref|><|box|>[[x1,y1,x2,y2]]</|box|>` → 精确定位+尺度
- **Point**：`<|point|>[[x1,y1],[x2,y2]]</|point|>` → 抽象空间引用，轨迹追踪

类比：人计数时用手指一个个点过去。模型也"指着想"。

## 3. 架构与 Token 效率

基于 DeepSeek-V4-Flash（284B MoE, 13B 激活），LLaVA 架构 + 多级压缩：

| 阶段 | Token 数 |
|------|---------|
| 原始像素 (756×756) | 571,536 |
| ViT Patch | 2,916 |
| 3×3 空间压缩 | 324 |
| CSA KV 缓存压缩 | **81** |

**总压缩比 7,056×**。一张 800×800 图像仅需 ~90 KV cache 条目，而 GPT-5.4 需 ~740，Claude Sonnet 4.6 需 ~870。

## 4. 数据工程（核心壁垒）

```
爬取 97,984 数据源
→ 语义审查(MLLM): 排除机器码/私有实体/模糊标签 → 43,141 保留
→ 几何质量审查: 排除漏标/截断/全局框 → 31,701 保留
→ 类别平衡采样 → 4,000万+ 训练样本
```

### 四项冷启动任务

- **Counting**（~10k 样本）：粗粒度+细粒度计数，含负样本（目标不存在时训练"忠实拒绝"）
- **Spatial Reasoning**（~9k 样本）：GQA 自然场景 + CLEVR 合成多跳推理
- **Maze Navigation**（~46万样本）：DFS/Prim/Kruskal 生成三种拓扑，含可解+不可解迷宫；奖励模型分解为因果探索进度、探索完整性、撞墙惩罚、路径有效性四个子指标
- **Path Tracing**（~12.5万样本）：Bézier 曲线纠缠图，uniform-style 模式强制依赖曲率连续

## 5. 训练策略

"先专项后统一"：

```
SFT 分训 → FTwG(box) + FTwP(point)
GRPO 专项 RL → ETwG + ETwP（三组 RM: Format + Quality + Accuracy）
Unified RFT → 统一模型 F
On-Policy Distillation → D_KL(π_θ ‖ π_Ei) → 最终模型
```

## 6. 关键结果

| 任务 | Ours | GPT-5.4 | Gemini-3 | Claude 4.6 |
|------|------|---------|----------|------------|
| Pixmo-Count | **89.2** | 76.6 | 88.2 | 68.7 |
| 迷宫导航 | **66.9** | 50.6 | 49.4 | 48.9 |
| 路径追踪 | **56.7** | 46.5 | 41.4 | 30.6 |

所有 frontier model 在拓扑推理上均表现不佳——论文诚实指出。

## 7. 为什么被删

论文于五一前夜发布后隔夜删除，GitHub 仓库 404。业界推测不是内容有误，而是**透露了太多技术细节**，包括完整的训练 pipeline 和任务设计方法论。

## 8. 设计与 AI4Sci 的关联

- **Reference Gap 可推广**：不仅在视觉领域，知识图谱、RAG 检索中也存在"指代歧义"
- **极端压缩 + 精确引用**：少量 token + 精确坐标 > 大量 token + 模糊描述，与流形特征优化检索的思路同源
- **任务设计方法论**：迷宫导航的难度控制和奖励分解策略，对设计 AI 推理评估任务有参考价值

---

*作者: Nemesis*  
*创建时间: 2026-05-05*  
*主题: 多模态 · Visual Primitives · Reference Gap · DeepSeek*
