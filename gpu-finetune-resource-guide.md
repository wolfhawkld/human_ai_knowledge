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

Ti-One 是腾讯内部的机器学习训练平台，类似 Kubeflow：

| 特点 | 说明 |
|------|------|
| **预装框架** | PyTorch、TensorFlow、Transformers |
| **资源分配** | GPU 按块分配（如 0.5块 L20 = 24GB） |
| **任务类型** | Notebook（交互调试）、Training Job（正式训练） |
| **调度系统** | 自动资源管理和任务队列 |

### GPU 资源对照

| GPU 类型 | 单卡显存 | 分块配置 |
|---------|---------|---------|
| **L20** | 48 GB | 0.5块 = 24GB |
| **A100** | 40/80 GB | 按需求分配 |
| **V100** | 32 GB | 按需求分配 |

### 环境准备

```bash
# 1. 检查 PyTorch 版本
python -c "import torch; print(torch.__version__)"

# 2. 安装额外依赖（如未预装）
pip install transformers datasets scikit-learn hdbscan

# 3. 检查 GPU 显存
nvidia-smi
```

### 创建训练任务

**推荐配置**：

| 参数 | 建议值 |
|------|-------|
| **GPU** | 0.5块 L20 (24GB) |
| **CPU** | 4 核 |
| **内存** | 16 GB |
| **框架** | PyTorch |

**任务类型选择**：

| 场景 | 任务类型 |
|------|---------|
| 调试代码、探索数据 | Notebook |
| 正式训练模型 | Training Job |
| 长时间实验 | Training Job（后台运行） |

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