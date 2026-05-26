# 主流开闭源 Embedding Model 全面对比

> 2026-05-21 · Nemesis · 标签：Embedding, MTEB, RAG, 语义检索

---

## 一、开源模型规格

### BGE 系列 (BAAI/北京智源人工智能研究院)

| 模型 | 参数 | 维度 | Token | 语言 | 许可证 | MTEB v1 |
|------|:----:|:----:|:-----:|------|:------:|:-------:|
| BGE-M3 | 569M | 1024 | 8192 | 100+ | MIT | ~63.0 |
| BGE-large-en-v1.5 | 335M | 1024 | 512 | EN | MIT | ~64.2 |
| BGE-large-zh-v1.5 | 326M | 1024 | 512 | ZH | MIT | 64.53(C) |
| BGE-base-en-v1.5 | 109M | 768 | 512 | EN | MIT | — |
| BGE-small-en-v1.5 | 33.4M | 384 | 512 | EN | MIT | — |

**BGE-M3 特点：** 单次推理输出 dense + sparse (lexical) + multi-vector (ColBERT) 三种向量，支持混合检索。

### E5 系列 (Microsoft / intfloat)

| 模型 | 参数 | 维度 | Token | 语言 | 许可证 | MTEB v1 |
|------|:----:|:----:|:-----:|------|:------:|:-------:|
| E5-Mistral-7B-instruct | 7.11B | 4096 | 32768 | EN | MIT | 67.97 |
| multilingual-e5-large | 560M | 1024 | 512 | 100+ | MIT | ~60+ |
| multilingual-e5-large-instruct | 560M | 1024 | 512 | 100+ | MIT | ~60+ |

**注意：** E5-Mistral-7B 虽然曾是 SOTA，但参数量大、推理成本高，作为 embedding 已略显过时。

### GTE 系列 (Alibaba/阿里通义)

| 模型 | 参数 | 维度 | Token | 语言 | 许可证 | MTEB v1 |
|------|:----:|:----:|:-----:|------|:------:|:-------:|
| gte-Qwen2-7B-instruct | 7B | 3584 | 32768 | 中英 | Apache 2.0 | 70.24 |
| gte-large-en-v1.5 | 434M | 1024 | 8192 | EN | Apache 2.0 | 65.39 |
| gte-modernbert-base | 149M | 768 | 8192 | EN | Apache 2.0 | 64.38 |
| mGTE | — | — | — | 75+ | Apache 2.0 | — |

**特点：** gte-Qwen2-7B 是 2024 年开源 No.1，gte-large-en-v1.5 是同尺寸最优。gte-modernbert-base 用 1/50 参数量逼近 7B 效果。

### Jina 系列 (Jina AI)

| 模型 | 参数 | 维度 | Token | 语言 | 许可证 |
|------|:----:|:----:|:-----:|------|:------:|
| jina-embeddings-v3 | 570M | 1024 | 8192 | 多语言 | CC BY-NC 4.0 |
| jina-embeddings-v4 | 3.8B | 1024/2048 | 32768 | 多语言+多模态 | CC BY-NC 4.0 |
| jina-embeddings-v5-text-small | 677M | 1024 | — | 119+ | Apache 2.0 |

**特点：** v3 内置 5 个 task-specific LoRA，v4 支持文本+图像统一向量空间，v5 蒸馏小模型性能接近 8B。

### Stella / Nomic / UAE

| 模型 | 参数 | 维度 | Token | 许可证 | MTEB v1 |
|------|:----:|:----:|:-----:|:------:|:-------:|
| stella_en_1.5B_v5 | 1.5B | 1024 | 32768 | Apache 2.0 | ~70+ |
| nomic-embed-text-v1.5 | 137M | 768 | 8192 | Apache 2.0 | 62.28 |
| UAE-Large-V1 | 335M | 1024 | 512 | MIT | 64.64 |

**Nomic 特点：** 极小体量（137M）、Apache 2.0 完全开源可审计、训练数据 235M pairs 完全公开。

---

## 二、闭源模型规格

| 模型 | 维度 | Token | 价格($/1M) | MTEB v1 | 特点 |
|------|:----:|:-----:|:----------:|:-------:|------|
| OpenAI text-embedding-3-large | 3072 | 8191 | 0.13 | 64.6 | 通用, 2024年1月后未更新 |
| OpenAI text-embedding-3-small | 1536 | 8191 | 0.02 | 62.3 | 极致性价比，比 ada-002 便宜 5x |
| OpenAI ada-002 (Legacy) | 1536 | 8191 | 0.10 | 61.0 | 不推荐新项目 |
| Cohere embed-v4.0 | 1536 | 128K | 0.12 | ~65.2 | 128K 上下文, 多模态 |
| Voyage-4-large | 1024 | 32K | 0.12 | ~66.8 | 通用+多语言 SOTA |
| Voyage-4 | 1024 | 32K | 0.06 | — | 中档 |
| Voyage-4-lite | 1024 | 32K | 0.02 | — | 极致便宜 |
| Voyage-code-3 | 1024 | 32K | 0.18 | — | 代码检索专用, 238 数据集 SOTA |
| Voyage-finance-2 | 1024 | 32K | 0.12 | — | 金融专用 |
| Voyage-law-2 | 1024 | 32K | 0.12 | — | 法律专用 |

**注意：** Voyage AI 2026 年已被 MongoDB 收购，所有模型赠送免费额度（4-large: 200M, 金融/法律: 50M）。

---

## 三、C-MTEB 中文基准关键数据

| 模型 | Avg | Retrieval | STS | PairClass | Class | Cluster |
|------|:---:|:---------:|:---:|:---------:|:-----:|:-------:|
| BGE-large-zh-v1.5 | 64.53 | 70.46 | 56.25 | 81.60 | 69.13 | 48.99 |

**说明：** gte-Qwen2-7B-instruct 中英文 MTEB 均领先开源；BGE-large-zh-v1.5 是中文场景最成熟方案。

---

## 四、硬件资源需求（自部署）

| 模型 | 参数 | VRAM(FP16) | 推荐 GPU |
|------|:----:|:----------:|---------|
| BGE-small / nomic-embed | 33-137M | 0.2-0.5GB | CPU / T4 |
| BGE-large / gte-large | 335-434M | 1.3-1.7GB | T4 / RTX 3060 |
| BGE-M3 / jina-v3 | 560-570M | 2.3GB | RTX 3060+ |
| stella_en_1.5B | 1.5B | 6GB | RTX 3090/4090 |
| jina-v4 | 3.8B | 15GB | RTX 4090 / A100 |
| gte-Qwen2-7B | 7B | 28GB | A100 40GB+ |

**推理框架：** TEI (HuggingFace) 推荐首选，sentence-transformers 适合 POC。自部署成本约为 API 的 1/5 到 1/20。

---

## 五、开源模型微调适配性

| 模型 | 全参数 | LoRA | 垂类适配难度 | 特点 |
|------|:------:|:----:|:----------:|------|
| BGE 系列 | ✅ | ✅ | **低** | BAAI 提供完整微调示例，M3 支持 dense+sparse+ColBERT 联合微调 |
| E5 系列 | ✅ | ✅ | 中 | 7B 全参数需 40GB+ |
| GTE 系列 | ✅ | ✅ | 中 | 7B 全参数资源需求高 |
| Jina系列 | — | ✅ | 低 | 原生 LoRA adapter 机制，不改 backbone |
| Nomic 系列 | ✅ | ✅ | **低** | 137M 全参数微调成本极低，代码+数据完全开源 |

**域适应方法：** TSDAE(无监督) → GPL(伪标签) → LoRA(3.6%参数) → 全参数微调

---

## 六、场景推荐

### 通用英文检索
1. **Voyage-4-large** ($0.12/1M, MTEB ~66.8) — API 精度最高
2. **gte-large-en-v1.5** (自部署免费, MTEB 65.39) — 性价比首选
3. **nomic-embed-text-v1.5** (137M, 62.28) — 极低成本
4. **OpenAI v3-small** ($0.02/1M) — API 最便宜

### 中文场景
1. **gte-Qwen2-7B-instruct** — 最强精度（需 28GB VRAM）
2. **BGE-large-zh-v1.5** (MIT) — 最成熟方案 + bge-reranker 两阶段
3. **BGE-M3** (MIT, 100+语言) — 多语言含中文

### 多语言
**BGE-M3** 自部署首选；**Cohere embed-v4** (128K 上下文) API 首选

### 代码搜索
**voyage-code-3** 大幅领先通用模型 13-16%；自部署用 **gte-modernbert-base**

### 金融/法律
**voyage-finance-2/law-2** API 即用；自部署用 BGE-M3 + 垂类语料域适应（TSDAE → LoRA），可提升 5-15%

### RAG 系统
- 第一阶段 Embedding 粗筛 top-100，第二阶段 Reranker 精排 top-5~20
- 小项目：BGE-M3 + BGE-Reranker
- 中规模：gte-large-en-v1.5 + bge-reranker-v2
- 企业级：Voyage-4-large 或 Cohere embed-v4

---

## 七、2026 关键趋势

1. **Matryoshka 嵌入已成标配** — 几乎所有模型支持变长向量，256 到 3072 维灵活切换
2. **多模态 Embedding 主流化** — Gemini 2, Cohere v4, Voyage 4, jina-v4 均支持图文统一嵌入
3. **Encoder 回归** — gte-modernbert-base (149M) 用 1/50 参数量逼近 7B decoder-only 效果
4. **开源追赶闭源** — jina-v5/Apache 2.0 在 MTEB v2 超越多数闭源模型
5. **域适应微调 > 选最强通用模型** — 垂类场景域适应提升远超模型间切换
6. **自部署成本 5-20x 低于 API** — TEI + GPU 自部署性价比极高
