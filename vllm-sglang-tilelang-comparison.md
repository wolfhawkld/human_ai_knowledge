# vLLM vs SGLang vs TileLang — LLM 推理框架对比

> 2026-05-21 · Nemesis · 分类：LLM 推理 · 标签：vLLM, SGLang, TileLang, 模型服务

---

## 一、概览

三个项目处于不同技术栈层级：

| 项目 | 定位 | 代表作 |
|------|------|--------|
| **vLLM** | 完整的 LLM 服务/推理引擎 | PagedAttention，Continuous Batching |
| **SGLang** | 完整的 LLM 服务/推理引擎 | RadixAttention，结构化输出 |
| **TileLang** | GPU 内核 DSL（领域特定语言） | DeepSeek TileKernels |

vLLM 和 SGLang 是**竞争关系**——都提供模型加载、请求调度、批处理、KV Cache 管理、分布式推理、HTTP API 服务等端到端能力。TileLang 是**底层算子开发工具**，不直接替代 vLLM/SGLang，可与二者组合使用。

---

## 二、核心架构

### vLLM

| 技术 | 说明 |
|------|------|
| **PagedAttention** | 核心创新。KV Cache 分页管理（类似操作系统虚拟内存），消除内存碎片 |
| **Continuous Batching** | 请求到达即插入运行中批次，不等当前批次完全结束 |
| **Prefix Caching** | 缓存公共前缀的 KV Cache |
| **Chunked Prefill** | 长 prompt 分块处理，避免独占 GPU 过久 |
| **CUDA Graph** | 支持 CUDA Graph 加速 decode 阶段 |
| **V1/V2 架构** | MRV2 在 GB200 上带来 56% 吞吐提升 |

### SGLang

| 技术 | 说明 |
|------|------|
| **RadixAttention** | 核心创新。基数树（Radix Tree）KV Cache 复用，自动检测共享前缀（系统提示词、RAG 模板、few-shot 等），比 vLLM 的 prefix caching 更精细 |
| **Zero-overhead CPU Scheduler** | CPU 端调度开销近乎为零 |
| **Prefill-Decode Disaggregation** | 预填充和解码分离，可独立扩展 |
| **Speculative Decoding** | 原生支持推测解码 |
| **结构化输出** | 原生支持 JSON Schema 约束解码，无需额外工具 |
| **SGLang 前端语言** | prompt 中嵌入编程逻辑 |

### TileLang

- 基于 **Apache TVM** 编译器基础设施
- **Pythonic DSL**：用 Python 语法表达 GPU 内核（GEMM、FlashAttention）
- **Auto Tiling**：自动选择最优 tile 配置
- **Auto TMA/WGMMA**：自动利用 H100 硬件指令
- **Auto Pipelining**：自动生成多级流水线调度
- **Layout Optimization**：自动布局优化
- **不提供**模型加载、batching、caching、HTTP API——它只是内核编写工具

---

## 三、模型支持

| 维度 | vLLM | SGLang | TileLang |
|------|------|--------|----------|
| HF 模型 | 200+ 架构，最广 | 主流全覆盖 | 不直接加载 |
| 量化 | AWQ, GPTQ, INT8, FP8, INT4 | AWQ, GPTQ, INT4, FP8, FP4 | 可自定义量化内核 |
| 多模态 | ✅ LLaVA, Qwen-VL 等 | ✅ LLaVA, Qwen-VL, GLM-4V | ❌ 不适用 |
| MoE | 原生支持 | 原生支持（含 Expert Parallelism） | 可写路由内核 |
| 新模型适配速度 | 极快（社区 PR 频繁） | 快 | 慢（需手动实现算子） |

---

## 四、性能对比

基于 H100 80GB, Llama-3.3-70B-Instruct FP8, 输入 512 tokens, 输出 256 tokens：

### 吞吐量 (Output Tokens/sec)

| 并发数 | vLLM | SGLang |
|-------|------|--------|
| 1 | 120 tok/s | 125 tok/s |
| 10 | 650 tok/s | 680 tok/s |
| 50 | 1,850 tok/s | **1,920 tok/s** |
| 100 | 2,400 tok/s | **2,460 tok/s** |

### 首 Token 延迟 (TTFT p50)

| 并发数 | vLLM | SGLang |
|-------|------|--------|
| 1 | 45 ms | **42 ms** |
| 10 | 120 ms | **112 ms** |
| 50 | 380 ms | **360 ms** |
| 100 | 740 ms | **710 ms** |

### 关键发现

1. SGLang 在中高并发下**略优于** vLLM
2. SGLang 在**前缀复用场景**（系统提示词、RAG 模板）优势可达 **2-5x**
3. 显存占用差异 < 4GB（引擎选择不如 `max-model-len` 和 `gpu-memory-utilization` 设置重要）
4. TileLang 不在此维度对比——它是底层算子工具

---

## 五、部署模式

| 维度 | vLLM | SGLang |
|------|------|--------|
| 单卡 | ✅ | ✅ |
| Tensor Parallelism | ✅ | ✅ |
| Pipeline Parallelism | ✅ | ✅ |
| Data Parallelism | ✅ | ✅ (优于 vLLM) |
| Expert Parallelism (MoE) | ✅ | ✅ |
| 多节点 | ✅ | ✅ |
| GPU 类型 | NVIDIA, AMD, TPU, Intel Gaudi, AWS Neuron, Apple Silicon | NVIDIA, AMD, TPU, Ascend NPU, Intel Xeon |
| 冷启动时间 | ~62s | ~58s |

---

## 六、独特特性

### vLLM 的独特优势

- 最广泛的模型架构支持（200+），社区首选测试平台
- PyTorch Foundation 成员，生态整合最深
- 多硬件后端最广（NVIDIA + AMD + TPU + Intel + AWS + Apple）
- 文档最完善：docs.vllm.ai, discuss.vllm.ai, slack.vllm.ai
- 70K+ Stars，2000+ 贡献者

### SGLang 的独特优势

- **RadixAttention**：前缀复用场景吞吐可超 vLLM 数倍
- **Prefill-Decode Disaggregation**：prefill 和 decode 分配到不同 GPU 独立扩展
- **结构化输出**：原生 JSON Schema 约束解码，Agent 场景极有价值
- **RL 训练集成**：被 AReaL、verl、Miles 等 RL 框架作为 rollout 后端
- **SGLang 前端语言**：prompt 中嵌入控制流、多模态、并行调用
- 宣称驱动全球 400,000+ GPU

### TileLang 的独特优势

- 80 行 Python 代码实现 FlashAttention，代码量减少 90%
- TVM 编译器后端：自动调度、内存布局、流水线优化
- DeepSeek TileKernels：生产级内核库（MoE 路由、FP4 量化、FlashMLA）
- 跨平台：同一代码编译到 CUDA、HIP、Metal
- ICLR 2026 Oral 论文

---

## 七、场景化推荐

| 场景 | 推荐 | 理由 |
|------|------|------|
| **通用生产级 API 服务** | **vLLM** | 模型最广、文档最全、社区最大、部署简单 |
| **RAG/Agent/多轮对话** | **SGLang** | RadixAttention 前缀复用优势，结构化输出 |
| **极致吞吐 + 稳定模型** | vLLM（或 TensorRT-LLM） | 均衡性能，编译优化可选 |
| **RL 训练 rollout** | **SGLang** | 被主流 RL 框架原生支持 |
| **自定义 GPU 算子** | **TileLang** | 比手写 CUDA 高效 10x |
| **非 NVIDIA 平台** | **vLLM** | 硬件后端最广 |

---

## 八、总结

- vLLM 是**更安全的全能默认选择**——模型广、文档好、社区大
- SGLang 在**特定场景（前缀复用、结构化输出、RL）有差异化优势**
- TileLang 定位在**完全不同层面**——编写高性能 GPU 内核的 Python DSL，可与 vLLM/SGLang 组合使用
- vLLM 和 SGLang 都在快速迭代，性能差距在缩小

---

## 参考链接

- [vLLM](https://github.com/vllm-project/vllm) — ~70K Stars
- [SGLang](https://github.com/sgl-project/sglang) — ~28K Stars
- [TileLang](https://github.com/tile-ai/tilelang) — ~5K Stars
- [DeepSeek TileKernels](https://github.com/deepseek-ai/tilekernels) — 基于 TileLang 的生产级内核
