# SGLang 推理框架及硬件适配全景

> **元信息**
> - **来源**: Damon 与 Nemo 的对话整理，结合公开文档
> - **日期**: 2026-05-09
> - **生成者**: Nemo
> - **版本**: 1.0

---

## 概述

SGLang 是由 LMSYS 组织开发的高性能推理框架，专为大语言模型（LLM）和多模态模型（VLM）设计。它通过创新的 RadixAttention 技术和 SGLang 领域专用语言（DSL），在结构化输出、多轮对话、RAG 等场景实现了显著性能优势。2025 年已被 DeepSeek 和 xAI 等公司深度采用，支撑超过 **400,000 张 GPU** 的生产部署。

---

## 一、核心架构创新

### 1.1 RadixAttention（核心创新）

SGLang 最关键的架构创新是基于 **Radix Tree（基数树）** 的 KV Cache 管理：

| 特性 | 说明 |
|------|------|
| **数据结构** | 基数树（Radix Tree），支持最长前缀匹配 |
| **Cache 粒度** | 每个 token 级别，不依赖 block 对齐 |
| **跨请求复用** | 不同请求之间的公共前缀可以共享 KV Cache |
| **内存效率** | 无 block 对齐浪费，自适应树结构自动演化 |
| **开销** | 不到 0.3% 的性能开销（即使无 Cache 命中场景） |

**与传统方案对比：**

| 特性 | vLLM (PagedAttention) | SGLang (RadixAttention) |
|------|----------------------|------------------------|
| 内存管理 | 分页块，<4% 浪费 | 分页块 + 基数树 Cache |
| Cache 复用 | 仅单请求内 | 跨请求前缀匹配 |
| 调度策略 | 连续批处理（FIFO） | Cache 感知（前缀优先） |
| 最佳场景 | 独立 prompts，批处理 | 共享前缀，多轮对话，RAG |

### 1.2 SGLang DSL（领域专用语言）

SGLang 提供一套 Python 嵌入的 DSL，支持链式生成调用、并行执行、结构化输出约束：

```
@function
def multi_turn(s, question):
    s += "Question: " + question
    s += "Answer: " + gen("answer", max_tokens=256)
    s += "Confidence: " + gen("confidence", choices=["High", "Medium", "Low"])
```

### 1.3 结构化生成

通过 **xGrammar** 引擎实现约束解码，支持 JSON Schema、正则表达式、上下文无关文法：

| 指标 | SGLang | 竞品 |
|------|--------|------|
| JSON 解码吞吐 | 2,900 tok/s | 580 tok/s（vLLM） |
| 合规率 | 96-98% | 依赖模型 |

---

## 二、性能基准

### 2.1 各场景吞吐量对比

| 工作负载 | vLLM | SGLang | 加速比 |
|---------|------|--------|--------|
| MMLU (5-shot) | 1,420 tok/s | 4,250 tok/s | **3.0x** |
| 多轮对话 | 890 tok/s | 4,180 tok/s | **4.7x** |
| JSON Decode | 580 tok/s | 2,900 tok/s | **5.0x** |
| 代码生成 | 1,200 tok/s | 3,600 tok/s | **3.0x** |
| Few-shot 学习 | 650 tok/s | 2,850 tok/s | **4.4x** |

### 2.2 首 Token 延迟（TTFT）

| 批次大小 | vLLM TTFT | SGLang TTFT | 改善 |
|---------|-----------|-------------|------|
| 1 | 45ms | 12ms | **73% faster** |
| 8 | 52ms | 18ms | 65% faster |
| 16 | 68ms | 28ms | 59% faster |
| 32 | 95ms | 45ms | 53% faster |

### 2.3 多模态推理

LLaVA-1.5 (Vision-Language)：

| 指标 | 基线 | SGLang |
|------|------|--------|
| 吞吐 | 28 img/s | **45 img/s** |
| TTFT | 650ms | **380ms** |
| 显存 | 16.2GB | **12.5GB** |

---

## 三、硬件适配全景

SGLang 是目前 **硬件覆盖最广** 的开源推理框架之一。

### 3.1 硬件支持矩阵

| 硬件平台 | 支持状态 | 后端/安装方式 | 生产级别 |
|---------|---------|--------------|---------|
| **NVIDIA** | ✅ 原生最优 | CUDA 12.9 + FlashInfer | ✅ 已验证 |
| **AMD Instinct** | ✅ 官方支持 | ROCm 7.2+ | ✅ |
| **AMD 消费卡** | ✅ 官方支持 | ROCm 7.2+（RX 7900 系列） | ⚠️ 实验性 |
| **Google TPU** | ✅ 支持 | SGLang-JAX 后端 | ✅ |
| **华为昇腾 NPU** | ✅ 支持 | Ascend NPU 专用安装 | ✅ |
| **Intel Xeon CPU** | ✅ 支持 | CPU 部署模式 | ✅ |
| **Intel XPU** | ✅ 支持 | XPU 平台安装 | ⚠️ |
| **摩尔线程 GPU** | ✅ 支持 | MUSA 平台安装 | ⚠️ 实验性 |
| **Apple MPS** | ✅ 实验性 | Apple Silicon 支持 | ⚠️ 实验性 |
| **NVIDIA Jetson** | ✅ 支持 | 边缘设备部署 | ✅ |

### 3.2 NVIDIA 深度优化

SGLang 与 NVIDIA 密切合作，充分利用 Blackwell 架构特性：

| 特性 | 说明 |
|------|------|
| **FP8 Attention** | Blackwell FP8 精度支持 |
| **NVFP4 MoE** | Blackwell NVFP4 混合精度 MoE |
| **PD-Disaggregated EP** | Prefill/Decode 分离 + Expert Parallelism |
| **Tensor Parallelism** | 多卡 TP，依赖 NVLink/NVSwitch |
| **GB200 NVL72** | DeepSeek R1 达到 **26k input / 13k output tok/s/GPU** |

### 3.3 AMD 支持详情

ROCm 7.2+ 正式支持 SGLang：

| GPU 型号 | 支持等级 | 备注 |
|---------|---------|------|
| MI355X | ✅ 生产级 | AMD 最新数据中心 GPU |
| MI300X | ✅ 生产级 | AMD Instinct 旗舰 |
| RX 7900 XTX/GRE | ✅ 官方支持 | ROCm 7.2 起官方文档支持 |
| RX 9070 系列 | ✅ 支持 | RDNA 4 架构 |
| 更老型号 | ⚠️ 兼容性不定 | 社区支持 |

**安装示例**：
```bash
pip install sglang[rocm]  # AMD ROCm
```

### 3.4 华为昇腾支持

华为昇腾 NPU 通过 **CANN** 软件栈获得 SGLang 支持：

- 昇腾 910B/C → 已验证可运行
- 昇腾 950DT → Atlas SuperPoD A5，2026 年
- 通过 MindSpore + vLLM/SGLang 集成路径
- 安装：`pip install sglang[ascend]`

### 3.5 国产 GPU 支持

| 芯片厂商 | SGLang 支持 | 备注 |
|---------|------------|------|
| 摩尔线程 | ✅ MUSA | 实验性支持 |
| 寒武纪 | ❌ 未官方支持 | 需 BM1684X 社区适配 |
| 海光 DCU | ❌ 未官方支持 | 需 ROCm 兼容路径 |
| 昆仑芯 | ❌ 未官方支持 | 需 XTCL 适配 |

---

## 四、部署模式

### 4.1 单机部署

| 模型规模 | 推荐硬件 | SGLang 配置 |
|---------|---------|-------------|
| ≤ 7B | 单卡 A10 / 4090 (24GB) | INT4 量化即可 |
| 14-32B | 2-4 卡 TP，bfloat16 | ~64GB 显存 |
| 70B | 4-8 卡 TP | FP8 可压到 4 卡 H100 |
| 200B+ MoE | 多机 EP + DP + TP | DeepSeek-V3/R1 专用 |

### 4.2 多机分布式

| 并行策略 | 说明 | 适用场景 |
|---------|------|---------|
| TP（Tensor Parallel） | 每层算子拆分，依赖 NVLink | 单机多卡 |
| PP（Pipeline Parallel） | 按层拆分，推理 bubble 大 | 超大模型 |
| EP（Expert Parallel） | MoE 专家拆分 | DeepSeek MoE |
| DP Attention | Attention 层数据并行 | DeepSeek-V3 风格 |

### 4.3 PD 分离（2024-2025 最大架构演进）

```
                        ┌─────────────┐
  用户请求 ────────────►│   Router    │
                        └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌──────────────┐       ┌──────────────┐
            │  Prefill Node │       │  Decode Node  │
            │ (Compute-bound)│       │ (Memory-bound)│
            │  8× A100      │       │  8× A100      │
            └───────┬───────┘       └──────┬───────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
                        ┌──────────────┐
                        │   响应返回     │
                        └──────────────┘
```

**核心优势**：Prefill 是计算密集型，Decode 是访存密集型——分开部署避免互相踩踏。

---

## 五、模型生态

### 5.1 支持的模型类型

| 类型 | 支持 |
|------|------|
| 文本生成 | Llama、Qwen、DeepSeek、Gemma、Mistral |
| 多模态 | LLaVA、LLaVA-NeXT、Qwen-VL |
| Embedding | e5-mistral、gte |
| Reward 模型 | Skywork |
| 扩散模型 | SGLang Diffusion（Wan2.2 等） |

### 5.2 DeepSeek 特殊关系

SGLang 是 **DeepSeek 官方推荐的推理引擎**：

- DeepSeek-V3/R1 **Day-0 支持**
- MTP（Multi-Token Prediction）层最早在 SGLang 落地
- MLA（Multi-Head Latent Attention）深度优化
- 弹性 EP：MoE 专家部署的故障容忍

---

## 六、框架生态对比

### 6.1 主流推理引擎全景

| 引擎 | 主导方 | 首发 | 定位 | License |
|------|--------|------|------|---------|
| **SGLang** | LMSYS → xAI/DeepSeek | 2024-01 | 高性能 + 结构化输出 | Apache-2.0 |
| **vLLM** | UC Berkeley → PyTorch Foundation | 2023-06 | 开源事实标准 | Apache-2.0 |
| **TensorRT-LLM** | NVIDIA | 2023-10 | NVIDIA 极致性能 | Apache-2.0（含闭源 kernel） |
| **TGI** | HuggingFace | 2022-11 | 早期标准，现回退企业场景 | Apache-2.0 |
| **LMDeploy** | 上海 AI Lab | 2023-06 | 国产对标 vLLM | Apache-2.0 |
| **MindIE** | 华为 | 2024 | 昇腾 NPU 专用 | 闭源商业 |
| **llama.cpp** | ggerganov | 2023-03 | 端侧/CPU/Mac | MIT |

### 6.2 选型决策树

```
硬件？
├─ NVIDIA GPU
│   ├─ 追求极致延迟 / 已有 Triton → TensorRT-LLM
│   ├─ 追求开源可 hack / 新模型最快速 → vLLM
│   ├─ 结构化输出密集 / 长前缀 / DeepSeek → SGLang ← 推荐
│   └─ 已在 HF Endpoints → TGI
├─ 华为昇腾 → MindIE（必选）/ SGLang（支持中）
├─ AMD ROCm → vLLM（官方最好）/ SGLang（逐步跟进）
├─ Intel Gaudi → vLLM-fork-gaudi / Optimum
├─ Apple Silicon → MLX-LM / Ollama
└─ CPU / 嵌入式 → llama.cpp / Ollama

模型规模？
├─ ≤13B → 以上任一均可
├─ 30-70B，单机多卡 TP → vLLM / SGLang / TRT-LLM
├─ 100B+ MoE → SGLang（EP + DP Attention 最完善）
└─ 超长上下文 (128k+) → SGLang / vLLM + PD 分离

约束？
├─ 强合规 / 信创 / 国产化 → LMDeploy / MindIE
├─ 低代码 / 快速 PoC → Ollama + OpenAI API
└─ 需要自定义调度 / 研究 → vLLM / SGLang
```

---

## 七、关键洞察

1. **RadixAttention 是差异化核心**：跨请求 KV Cache 复用在 RAG、多轮对话、Few-shot 场景效果显著，且几乎零开销
2. **硬件覆盖最广**：NVIDIA → AMD → Google TPU → 华为昇腾 → Intel CPU → 摩尔线程 → Apple MPS，是目前开源推理引擎中硬件适配最全面的
3. **DeepSeek 的事实标准**：SGLang 是 DeepSeek-V3/R1 官方指定引擎，MLA 优化领先同行
4. **国产硬件生态仍在追赶**：华为昇腾已支持，但摩尔线程、寒武纪、海光等国产 GPU 支持度有限；国内首选仍是 NVIDIA 或昇腾
5. **vLLM vs SGLang 非零和**：两者开源互补，vLLM 是"普适标准"，SGLang 是"场景特化利器"
6. **RL 训练后端**：SGLang 不仅用于推理，还被 AReaL、Miles、verl 等 RL 训练框架作为 rollout 后端

---

## 八、一句话总结

**SGLang 凭借 RadixAttention 和结构化生成在共享前缀场景领先行业，硬件覆盖横跨 NVIDIA/AMD/TPU/昇腾，是 DeepSeek 模型生态的事实标准引擎。** 🚀

---

## 参考来源

- [SGLang 官方文档](https://docs.sglang.ai/)
- [SGLang GitHub](https://github.com/sgl-project/sglang)
- [LMSYS Blog: RadixAttention](https://lmsys.org/blog/2024-01-17-sglang/)
- [arXiv: SGLang 论文 (2312.07104)](https://arxiv.org/abs/2312.07104)
- [NVIDIA SGLang Release Notes](https://docs.nvidia.com/deeplearning/frameworks/sglang-release-notes/)
- [AMD ROCm Blogs: SGLang](https://rocm.blogs.amd.com/artificial-intelligence/sglang/README.html)
- [SGLang vs vLLM 2026 对比](https://particula.tech/blog/sglang-vs-vllm-inference-engine-comparison)
- [vLLM/SGLang/TensorRT-LLM/TGI 对比 - 土法炼钢](https://quant67.com/post/llm-infra/13-vllm-sglang/13-vllm-sglang.html)
- [华为技术总第 100 期: CANN + SGLang](https://www-file.huawei.com/)
- [SemiAnalysis InferenceMAX: SGLang + GB200](https://lmsys.org/blog/2025-10-14-sa-inference-max/)
