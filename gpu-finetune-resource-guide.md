# GPU 显存与模型 Fine-tune 资源配置指南

> 元信息：Nemo 整理，2026-04-14，基于 Ti-One 平台实践经验

---

## 概述

在有限 GPU 显存资源下（如 24GB），如何选择合适的模型进行 fine-tune？不同任务类型（LLM、BERT、RL）的模型选择和资源配置方案。

---

## 显存与模型规模对照表

### 基本原则

| Fine-tuning 方法 | 显存需求（每 1B 参数） | 计算公式 |
|-----------------|---------------------|---------|
| **Full Fine-tuning** | ~20-30 GB/B | 参数量 × 精度 × 3~4（梯度+优化器） |
| **LoRA (16-bit)** | ~2 GB/B + overhead | 基模 2GB/B + LoRA 参数 + optimizer |
| **QLoRA (4-bit)** | ~0.5-0.6 GB/B | 量化后的基模 + LoRA + optimizer |

### 24GB 显存推荐模型

#### QLoRA (4-bit) 方案

| 模型 | 参数量 | 显存占用 | 可行性 | 推荐场景 |
|------|--------|---------|--------|---------|
| **Qwen2.5-7B** | 7B | 4-5 GB | ✅ 推荐 | 中文任务首选 |
| **Qwen2.5-14B** | 14B | 8-10 GB | ✅ 可行 | 需要更强能力 |
| **LLaMA-3-8B** | 8B | 5-6 GB | ✅ 推荐 | 英文任务首选 |
| **LLaMA-2-13B** | 13B | 8-10 GB | ✅ 可行 | 经典选择 |

#### LoRA (16-bit) 方案

| 模型 | 参数量 | 显存占用 | 可行性 |
|------|--------|---------|--------|
| **Qwen2.5-3B** | 3B | 6-7 GB | ✅ 推荐 |
| **Qwen2.5-7B** | 7B | 14-16 GB | ✅ 可行 |
| **BERT-large** | 340M | 2-4 GB | ✅ 随便跑 |

#### BERT 类模型（全参数微调）

| 模型 | 参数量 | 显存占用 | 说明 |
|------|--------|---------|------|
| **BERT-base** | 110M | ~0.5 GB | 24GB 可跑多任务并行 |
| **BERT-large** | 340M | ~1-2 GB | 全参数微调轻松 |
| **RoBERTa-large** | 355M | ~1-2 GB | 同上 |
| **DeBERTa-v3-large** | 390M | ~2 GB | 中文效果好 |

---

## 任务类型与模型选择

### 语义类任务（分类、聚类）

| 任务 | 推荐模型 | 显存需求 | 训练方式 |
|------|---------|---------|---------|
| **意图分类** | BERT-base/large | 1-4 GB | 全参数微调 |
| **语义聚类** | Sentence-BERT | 1-2 GB | Embedding + HDBSCAN |
| **情感分析** | BERT-base | < 1 GB | 全参数微调 |

### 生成类任务（摘要、对话）

| 任务 | 推荐模型 | 显存需求 | 训练方式 |
|------|---------|---------|---------|
| **文本摘要** | Qwen2.5-1.5B/3B | 6-10 GB | QLoRA |
| **对话生成** | Qwen2.5-3B | 10-12 GB | QLoRA |

### RL 算法验证任务

| 任务类型 | 推荐模型 | 显存需求 | 算法 |
|----------|---------|---------|------|
| **经典 RL（CartPole）** | 小型 MLP | < 100 MB | PPO/DQN/A2C |
| **语义分类 RL** | BERT + MLP | 1-2 GB | PPO/RLHF |
| **摘要生成 RL（SUPO）** | Qwen2.5-1.5B | 6-8 GB | Policy Gradient |

---

## Ti-One 平台配置指南

### 平台概述

Ti-One 是腾讯云的一站式机器学习平台：

| 特点 | 说明 |
|------|------|
| **预装框架** | PyTorch、TensorFlow、Transformers、Pandas 等 |
| **资源分配** | GPU 按块分配（支持 0.1-1 卡数的虚拟化） |
| **任务类型** | Notebook（交互调试）、Training Job（任务式建模） |
| **调度系统** | 资源组管理 + 自动调度 |
| **存储支持** | CFS、GooseFSx、COS、数据集 |

---

### 控制台入口

| 功能 | URL |
|------|-----|
| **TI-ONE 控制台** | https://console.cloud.tencent.com/tione/v2 |
| **新建 Notebook** | https://console.cloud.tencent.com/tione/v2/notebook/create |
| **新建训练任务** | https://console.cloud.tencent.com/tione/v2/job/create |
| **资源组管理** | https://console.cloud.tencent.com/tione/v2/resource |

---

### GPU 资源与虚拟化

#### 支持的 GPU 型号

| GPU 类型 | 单卡显存 | 支持虚拟化 |
|---------|---------|-----------|
| **L20** | 48 GB | ✅ 支持 |
| **A100** | 40/80 GB | ✅ 支持 |
| **V100** | 32 GB | ✅ 支持 |
| **T4** | 16 GB | ✅ 支持 |
| **A10** | 24 GB | ✅ 支持 |
| **A800** | 80 GB | ✅ 支持 |

#### GPU 虚拟化功能

Ti-One 支持 **GPU 虚拟化**，可将一张 GPU 卡的算力分配给不同任务：

| 配置 | 说明 |
|------|------|
| **卡数范围** | 0.1 - 1 之间的数值 |
| **典型配置** | 0.5块 = 半卡，0.25块 = 四分之一卡 |
| **适用场景** | 小模型微调、推理服务、资源利用率优化 |

**示例**：
- L20 单卡 48GB → 0.5块 = 24GB 显存
- A100 单卡 80GB → 0.25块 = 20GB 显存

---

### 创建训练任务完整步骤

#### 前置准备

1. **计算资源**：创建资源组，购买/添加 CVM 节点
2. **存储资源**：申请 CFS 或 GooseFSx 文件系统

#### Step 1: 填写基本信息

进入 **训练工坊 > 任务式建模 > 新建**

| 配置项 | 说明 |
|--------|------|
| **任务名称** | 中英文、数字、下划线、短横 |
| **地域** | 训练任务所在地域 |
| **训练镜像** | 平台内置镜像 / 自定义镜像 / 内置大模型 |
| **机器来源** | 从 CVM 选择 / 从 TI-ONE 购买 |
| **GPU 配置** | 选择资源组 + GPU 卡数（可选 0.1-1） |
| **RDMA** | 多节点任务可开启（加速多机通信） |

**GPU 概览信息**：选择资源组后可查看：
- 各卡型号的 GPU 总卡数
- 整机卡数 vs 碎卡数（非整机卡数）
- 帮助选择整机或碎卡资源，降低碎片化

#### Step 2: 配置任务参数

| 配置项 | 说明 |
|--------|------|
| **存储路径** | 数据集 / 数据源 / COS / CFS / GooseFSx |
| **Git 存储** | 配置代码仓库，自动下载到容器 |
| **启动命令** | 程序入口，默认工作目录 `/opt/ml/code` |
| **训练输出** | 输出到 COS，默认上传 `/opt/ml/output` |
| **调优参数** | JSON 格式超参数，保存到 `/opt/ml/input/config/hyperparameters.json` |
| **SSH 连接** | 启用远程 SSH 访问（仅 CVM 来源支持） |

#### Step 3: 启动任务

配置完成后，任务进入队列等待调度。

---

### 内置大模型精调（一键启动）

Ti-One 内置多种大模型精调模板，可直接使用：

| 模型 | 说明 |
|------|------|
| **Qwen 系列** | 中文首选，支持 sft/pt/dpo 模式 |
| **LLaMA 系列** | 英文首选 |
| **其他开源模型** | 平台持续更新 |

#### 预置配置

平台自动配置：
1. **平台 CFS**：精调配套训练代码
2. **平台 CFS**：示例数据（可替换为自定义数据）
3. **平台 CFS**：内置模型权重
4. **用户 CFS**：训练输出路径

#### 关键超参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| **Stage** | sft | 训练模式：sft/pt/dpo |
| **Epoch** | 2 | 训练轮次 |
| **BatchSize** | 1 | 每轮样本数 |
| **LearningRate** | 1e-5 | 学习率 |
| **FinetuningType** | LoRA | 精调类型：LoRA/Full |
| **MaxSequenceLength** | 2048 | 最大序列长度 |
| **DeepSpeedZeroStage** | z3 | DeepSpeed ZeRO 阶段 |
| **GradientCheckPointing** | True | 时间换显存策略 |

---

### 推荐配置方案

#### BERT 微调任务

| 参数 | 推荐值 |
|------|-------|
| **GPU** | 0.5块 L20 (24GB) 或更少 |
| **CPU** | 4 核 |
| **内存** | 16 GB |
| **镜像** | 内置 PyTorch 镜像 |
| **存储** | CFS（数据 + 输出） |

#### QLoRA 微调任务

| 参数 | 推荐值 |
|------|-------|
| **GPU** | 0.5块 L20 (24GB) 或 0.25块 A100 |
| **CPU** | 4-8 核 |
| **内存** | 32 GB |
| **镜像** | 内置 PyTorch 镜像或自定义 |
| **超参** | FinetuningType=LoRA, DeepSpeedZeroStage=z3 |

#### 内置大模型精调

| 参数 | 推荐值 |
|------|-------|
| **GPU** | 根据模型选择（Qwen-7B: 0.5块 L20） |
| **模型** | 选择内置大模型模板 |
| **数据** | 按平台约定格式准备 |
| **超参** | 直接修改 JSON 即可 |

---

### 任务类型选择

| 场景 | 任务类型 | 说明 |
|------|---------|------|
| 调试代码、探索数据 | **Notebook** | Jupyter 交互环境 |
| 正式训练模型 | **Training Job** | 后台运行，自动调度 |
| 大模型精调 | **内置大模型模板** | 一键启动 |
| 长时间实验 | **Training Job** | 支持自动重启、健康检测 |

---

### 任务管理功能

| 功能 | 说明 |
|------|------|
| **自动重启** | 任务异常/节点故障后自动重试（最多 10 次） |
| **健康检测** | NCCL 网络、慢节点、All-to-All 检测 |
| **CLS 日志投递** | 持久化存储日志，支持检索 |
| **资源看板** | 实时查看 GPU 使用情况、节点任务 |
| **SSH 连接** | 远程访问训练容器 |

---

### 环境准备代码

```bash
# 1. 检查 PyTorch 版本
python -c "import torch; print(torch.__version__)"

# 2. 安装额外依赖（如未预装）
pip install transformers datasets scikit-learn hdbscan peft

# 3. 检查 GPU 显存
nvidia-smi

# 4. 检查可用 GPU 数
python -c "import torch; print(f'GPU count: {torch.cuda.device_count()}')"
```

### BERT 微调示例代码

```python
# train_intent_classifier.py
from transformers import BertForSequenceClassification, Trainer, TrainingArguments

# 1. 加载模型
model = BertForSequenceClassification.from_pretrained(
    "bert-base-chinese",  # 中文任务
    num_labels=5  # Speech Act 5类意图
)

# 2. 训练参数（适配 24GB 显存）
training_args = TrainingArguments(
    output_dir="./output",
    num_train_epochs=3,
    per_device_train_batch_size=16,  # 24GB 可用较大 batch
    per_device_eval_batch_size=32,
    learning_rate=2e-5,
    fp16=True,  # 混合精度节省显存
)

# 3. 开始训练
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_data,
    eval_dataset=eval_data,
)
trainer.train()
```

### QLoRA 微调示例代码

```python
# train_qwen_qlora.py
from transformers import AutoModelForCausalLM, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model

# 1. 4-bit 量化配置
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
)

# 2. 加载模型
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    quantization_config=bnb_config,
    device_map="auto",
)

# 3. LoRA 配置
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
)

# 4. 应用 LoRA
model = get_peft_model(model, lora_config)

# 5. 训练（显存约 8-10 GB）
```

---

## IntentWeight 项目应用建议

### 任务匹配

| IntentWeight 需求 | 推荐方案 |
|------------------|---------|
| **意图聚类** | BERT-large embedding + HDBSCAN |
| **意图分类** | BERT-base/large 微调（Speech Act 5类） |
| **意图-数据关联** | BERT + RL（后续 Phase 3） |

### 实施路径

```
Phase 1A → BERT 分类器替代零样本分类
Phase 1B → BERT embedding 替代 MiniLM
Phase 2  → BERT + KG 实体融合
Phase 3  → BERT + RL 动态权重学习
```

---

## 核心结论

1. **24GB 显存足够**：BERT 全参数微调、QLoRA-7B/14B、小型 LLM + RL
2. **BERT 类模型轻松**：全参数微调，不需要 LoRA/QLoRA
3. **LLM 需要 QLoRA**：否则显存不够
4. **RL 算法验证极省资源**：MLP + CartPole 几乎零开销
5. **语义类 RL 需要 BERT**：不能用纯 MLP

---

## 一句话总结

24GB 显存可以轻松微调 BERT（全参数），也可以用 QLoRA 微调 7B-14B LLM，是语义类任务（意图分类、聚类）和 RL 验证的理想配置。

---

## 相关资源

- IntentWeight 项目：`~/.openclaw/workspace/IntentWeight/`
- Ti-One 平台文档：（内部链接）
- QLoRA 论文：[arXiv:2305.14314](https://arxiv.org/abs/2305.14314)
- LoRA 论文：[arXiv:2106.09685](https://arxiv.org/abs/2106.09685)

---

*整理者：Nemo | 生成时间：2026-04-14*