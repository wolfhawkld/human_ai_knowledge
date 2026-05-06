# DeepSeek "Thinking with Visual Primitives"：视觉思维的最小单元

> DeepSeek 2026年4月30日发布、隔夜即删的重磅多模态论文。首次提出 "Reference Gap" 概念，将点坐标和 bounding box 提升为模型的"思维最小单元"，用极低视觉 token 消耗超越 GPT-5.4/Claude/Gemini 的空间推理能力。论文已从 GitHub 404，社区镜像：https://www.k-a.in/Thinking_with_Visual_Primitives.pdf

---

## 1. 核心问题：Reference Gap

论文直击当前多模态模型的根本缺陷——不是"看不清"（Perception Gap），而是"**指不准**"（Reference Gap）。

```
现有方案：高分辨率裁剪/动态patching → 解决「看不清」
    ↓ 但是...
CoT 推理仍用自然语言描述 → "左边的那个大的""靠近中心的红色物体"
    ↓
在密集场景中自然语言无法精确定位 → 注意力漂移 → 推理崩溃
```

关键洞察：**再强的感知能力也无法替代精确的指代能力**。

---

## 2. 解决方案：Visual Primitives

把空间标记——**点坐标**和**bounding box**——提升为"**思维的最小单元**"（minimal units of thought）。模型在推理时，每引用一个视觉对象就同时输出其精确空间坐标。

类比：**人计数时用手指一个个点过去**。模型也"指着想"。

### 两种 Visual Primitive

| Primitive | 格式 | 最适合 |
|-----------|------|--------|
| **Bounding Box** | `<|ref|>TARGET</|ref|><|box|>[[x1,y1,x2,y2]]</|box|>` | 精确位置+尺度，物体识别/计数 |
| **Point** | `<|point|>[[x1,y1],[x2,y2]]</|point|>` | 抽象空间引用，轨迹追踪/拓扑推理 |

坐标归一化到 [0, 999] 的离散整数。Bounding Box 比 Point 更基础——训练了 box 后点格式可自然泛化，因为 box 本身由两个点定义。

---

## 3. 架构与极端的 Token 效率

### 基础架构

基于 **DeepSeek-V4-Flash**（284B MoE，13B 激活），标准 LLaVA 架构 + 多级压缩：

```
Image → ViT (DeepSeek-ViT, 14×14 patch)
     → 3×3 Spatial Compression（每9个patch压缩为1个token）
     → LLM (DeepSeek-V4-Flash, CSA enabled)
     → KV Cache 再被 CSA 压缩 4×
```

### Token 效率拆解（756×756 图像）

| 阶段 | Token 数 | 说明 |
|------|---------|------|
| 原始像素 | 571,536 | 输入 |
| Patch Embedding | 2,916 | 14×14 patch |
| 3×3 空间压缩 | 324 | ViT 输出 |
| CSA KV 缓存压缩 | **81** | LLM 推理时 KV cache |

**总压缩比：7,056×**（像素→KV cache）

### 跨模型对比（同为 800×800）

| 模型 | KV Cache 条目 |
|------|-------------|
| **Ours (284B-A13B)** | **~90** |
| Qwen3-VL (235B) | ~289 |
| Gemma-4 (31B) | ~361 |
| GPT-5.4 | ~660 |
| Claude Sonnet 4.6 | ~740 |
| Gemini-3-Flash | ~870 |
| 未压缩基线 | ~1,100 |

论文核心论点：**精确的空间引用可以补偿视觉 token 的不足**——模型不需要"看更多像素"，需要"指得更精确"。

---

## 4. 数据工程（论文最核心的护城河）

### 大规模 Web 数据构建：三级过滤

```
爬取阶段: HuggingFace API → 筛选 "Object Detection"/"Grounding" 标签
         → 97,984 个数据源
           ↓
语义审查 (MLLM 驱动): 排除三类致命缺陷
  • 无意义机器码 ("0","1") → 缺人类可读语义
  • 不可泛化私有实体 ("MyRoommate","ID_Card_1") → 无法从孤立样本学习
  • 模糊缩写 ("OK","NG") → 缺乏跨场景视觉一致性
         → 43,141 保留
           ↓
视觉-几何质量审查:
  • 严重漏标 (>50% miss rate) → 直接丢弃
  • 严重截断/偏移 → 轻微偏差容忍，截断特征区则丢弃
  • Mega Box (>90% 图像面积) → 分类数据误标为检测数据
         → 31,701 保留
           ↓
类别平衡采样 (N=1,000 per category) + 全局去重
         → 4,000万+ 高质量样本
```

### 冷启动任务设计（四个维度）

#### (a) Counting（计数）~10,000 samples

- **粗粒度计数**：聚合 COCO、Objects365、CrowdHuman 等密集检测数据集。MLLM 生成结构化 thinking chain：Intent Analysis → Batch Grounding → Statistical Summation。严格验证 box 坐标与 metadata 对齐
- **细粒度计数**：基于 GQA scene graph 自动生成属性约束问题（如"在地上的熊有多少只"）。sequential scan：逐一识别+验证每个可能对象 vs 约束条件
- **零计数负样本**：目标不存在时训练模型"忠实拒绝"

#### (b) Spatial Reasoning & General VQA ~9,000 samples

- **自然场景**：GQA scene graph + MLLM 生成多属性约束空间推理问题。多步引用时用 distinctive objects + multi-attribute constraints 去歧义
- **合成场景**：CLEVR toolchain 生成多跳推理 → 3D object 坐标投影到 2D bbox → MLLM 合成 "Thinking with Visual Primitives" chain（意图分析 → 任务分解 → 多跳 grounded 推理）
- **负样本**：目标/关系不存在时 → "faithful refusal"

#### (c) Maze Navigation（迷宫导航）~460,000 samples — 最创新的设计

**生成方法**：DFS/Prim/Kruskal 算法生成三种拓扑：矩形网格、圆形（同心环+扇形）、六边形蜂窝。

**难度控制**：通过网格大小控制推理步数。Easy：几步局部连接检查。Nightmare：数百步持续性长程推理，不能丢失已探索区域。

**不可解迷宫**：先生成可解路径 → 在路径中段放置墙壁 → 需要完整搜索才能确认无解。视觉风格随机化（渐变、厚壁、背景纹理、标记类型、小角度旋转）防止过拟合。

**奖励设计**（RL 阶段，五个组件加权）：

| 组件 | 机制 | 适用 |
|------|------|------|
| Causal exploration progress | 遇墙违规后截断→计算已探索区域到终点最短距离 | 可解迷宫 |
| Exploration completeness | 已探索可达区域 / 全部可达区域 | 不可解迷宫 |
| Wall violation penalty | 独立扫描全部探索轨迹，每次撞墙扣分 | 全部 |
| Final path validity | 路径连续性 + 无墙违规（二值） | 可解迷宫 |
| Answer correctness | 可解/不可解判断是否匹配 ground truth | 全部 |

#### (d) Path Tracing（路径追踪）~125,000 samples

Bézier 曲线纠缠图 → 模型必须沿特定曲线找到对应端点。核心挑战在**交叉点消除歧义**：必须基于局部几何连续性（曲率）判断哪条分支正确，而非颜色（uniform-style 模式：所有线同色同宽强制依赖曲率）。难度通过曲线数量+曲率幅度缩放。

双向轨迹评估：forward 方向惩罚偏离真实路径，reverse 方向惩罚不完整覆盖。防止模型"输出几个安全点+直接跳到猜的终点"。

---

## 5. 训练策略

### Post-Training Pipeline："先专项后统一"

```
Pretrained Model
    │
    ├─ Specialized SFT (冷启动数据):
    │     • FTwG: thinking with grounding (boxes)
    │     • FTwP: thinking with pointing (points)
    │     分开训练避免 mode conflict
    │
    ├─ Specialized RL (GRPO):
    │     • ETwG: box expert
    │     • ETwP: point expert
    │     三组 RM: Format + Quality + Accuracy
    │     RL 数据池用难度分层：Easy/Normal/Hard
    │     → 只选 "Normal" 样本做 RL
    │
    ├─ Unified RFT:
    │     • ETwG/ETwP rollout → 筛选 Normal + 5% Easy
    │     • 从 base pretrained model 重新 SFT → Unified model F
    │
    └─ On-Policy Distillation:
          L = Σ w_i · D_KL(π_θ || π_Ei)
          学生从 box expert + point expert distilling
          → 最终统一模型
```

### RL 奖励模型（三组并行）

| RM | 类型 | 功能 |
|----|------|------|
| **Format RM** | 规则 | Visual primitive 格式正确性，去重（防 box 循环生成） |
| **Quality RM** | LLM GRM | 冗余检查、thinking/response 一致性、自相矛盾检测、reward hacking 检测（模型编造假 ground truth 骗 RM） |
| **Accuracy RM** | 规则/GRM | 任务特定（见下方） |

### 计数 Accuracy RM：平滑指数衰减而非二值匹配

```
R(ŷ, y) = 0.7 × exp(-3 × |ŷ - y| / (|y| + 1))
```

"差一点点"比"差很远"惩罚轻，对大数量场景更宽容（|y| 大时分母大）。

### 难度分层 RL

用 SFT 冷启动模型做 N 次 rollout → 分三档：
- **Easy**: N 次全对 → 丢弃
- **Normal**: k 次对 (1 ≤ k < N) → **选这批做 RL**
- **Hard**: 0 次对 → 太难，丢弃

---

## 6. 实验结果

### 性能对比

| 任务 | 基准 | Ours | GPT-5.4 | Gemini-3 | Claude 4.6 |
|------|------|------|---------|----------|------------|
| 计数 | Pixmo-Count | **89.2** | 76.6 | 88.2 | 68.7 |
| 细粒度计数 | DS_Finegrained | **88.7** | 84.2 | 79.1 | 82.6 |
| 迷宫导航 | DS_Maze | **66.9** | 50.6 | 49.4 | 48.9 |
| 路径追踪 | DS_Path | **56.7** | 46.5 | 41.4 | 30.6 |
| 空间推理 | DS_Spatial | **98.7** | 81.1 | 93.2 | 97.2 |
| 通用 VQA | MIHBench | **85.3** | 83.5 | 83.2 | 81.7 |

**所有 frontier model 在拓扑推理上表现都很差**——论文诚实指出。迷宫导航所有对手低于 51%，路径追踪低于 47%。

### 定性发现

- 模型可**结合世界知识**做 VQA（识别金门大桥 → 推断旧金山 → 回答 NBA 球队问题）
- 可做**中文理解和输出**，尽管 visual primitive 训练数据全英文（基础模型的多语言能力传递）
- 在 counter-commonsense 场景中表现良好（判断天平上哪个重）

---

## 7. 局限

1. **输入分辨率限制**：超精细场景下 visual primitive 定位不精确，可与 Perception Gap 方法结合
2. **触发词依赖**：需显式触发词激活 visual primitive 机制，未来应自主判断
3. **跨场景泛化不足**：point 格式的拓扑推理在全新场景中仍有退化

---

## 8. 为什么被删

论文于五一前夜（4月30日）发布后隔夜删除，GitHub 仓库 404。Chen Xiaokang（多模态团队负责人）4月29日在 X 上发帖"Now, we can see you."。DeepSeek 官方定义 V4 时聚焦 agent 能力、世界知识、文本推理，**未包含多模态**，外界以为算力/资金约束导致多模态训练暂停。这篇论文表明进度远超预期。业内推测删除原因是**透露了太多技术细节**——完整的训练 pipeline、任务设计方法论、数据筛选策略。

---

## 9. 与 AI4Sci 的关联

1. **Reference Gap 可推广**：不仅在视觉领域，"指代歧义"在知识图谱、RAG 检索中也存在（"那个相关文档"到底指哪个？）
2. **Visual Primitives** 可类比到**知识检索**：给检索到的 chunk 一个精确的"知识坐标"（位置向量、chunk ID、知识图谱节点）而非模糊的语义描述
3. **极端压缩 + 精确引用**的设计哲学：少量 token + 精确坐标 > 大量 token + 模糊描述。与 IntentWeight 论文中"用流形特征做检索优化的思路"同源——本质上都是在信息资源有限的情况下，用结构化信息换取精度

---

*作者: Nemesis*  
*创建时间: 2026-05-05*  
*主题: 多模态 · Visual Primitives · Reference Gap · DeepSeek · AI4Sci*
