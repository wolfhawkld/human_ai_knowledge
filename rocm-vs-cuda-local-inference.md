# ROCm vs CUDA 本地推理：库栈、流程、代码全维度对比

> 2026-06-21 · Damon + Metis · 分类：MLOps / 本地推理 · 标签：ROCm, CUDA, AMD, NVIDIA, PyTorch, vLLM, 部署

---

## 一、核心心智模型

```
应用层      [你的代码 / sentence-transformers / FlagEmbedding]
               │
           [PyTorch / Transformers]      ← 这一层 API 完全相同
               │
       ┌───────┴────────┐
       │                │
   torch+cuda      torch+rocm        ← wheel 二选一，不能共存
       │                │
   [CUDA Runtime]  [HIP Runtime]    ← HIP 是 CUDA 的"双胞胎兄弟"
       │                │
   [cuBLAS/cuDNN]  [rocBLAS/MIOpen] ← 数学库一一对应
       │                │
   [NVIDIA Driver] [amdgpu Driver]  ← 内核驱动
       │                │
   [NVIDIA GPU]    [AMD GPU]
```

**核心洞察**：
- HIP（Heterogeneous Interface for Portability）= 让 CUDA 代码"零修改"跑在 AMD 上的兼容层
- PyTorch 源码层做了 CUDA→HIP 的翻译，**你写的 `torch.cuda.xxx` 在两边都能跑**
- 真正的差别在 wheel + 底层库 + 部分高级特性

---

## 二、库栈一一对应表

### 2.1 底层库映射

| 功能 | CUDA 生态 | ROCm 生态 | 兼容性 |
|---|---|---|---|
| **GPU 编程模型** | CUDA | HIP（API 名同 CUDA） | 源码可移植 |
| **运行时** | CUDA Runtime (`libcudart`) | HIP Runtime (`libamdhip64`) | API 同名 |
| **驱动 API** | CUDA Driver API | HSA Runtime | 抽象层不同 |
| **BLAS** | cuBLAS | rocBLAS / hipBLAS | API 兼容 |
| **DNN 算子** | cuDNN | MIOpen | API 不同，PyTorch 屏蔽 |
| **FFT** | cuFFT | rocFFT / hipFFT | API 兼容 |
| **稀疏矩阵** | cuSPARSE | rocSPARSE / hipSPARSE | API 兼容 |
| **求解器** | cuSOLVER | rocSOLVER / hipSOLVER | API 兼容 |
| **集合通信** | NCCL | RCCL（同名 API） | API 兼容 |
| **图像/视频** | NPP / NVDEC | rocAL / rocDecode | 部分对应 |
| **JIT 编译器** | NVRTC | hipRTC / Composable Kernel | API 兼容 |
| **GPU 监控** | `nvidia-smi` | `rocm-smi` | 命令类似 |
| **性能分析** | Nsight Systems/Compute | rocprof / Omnitrace | 工具不同 |
| **调试器** | cuda-gdb | rocgdb | 命令类似 |

### 2.2 上层 ML 框架支持

| 框架 / 库 | CUDA | ROCm | 备注 |
|---|---|---|---|
| **PyTorch** | ✅ 原生 | ✅ 官方 wheel | `torch+rocm` 包名仍叫 `torch` |
| **TensorFlow** | ✅ 原生 | ✅ 官方支持 | 滞后于 PyTorch |
| **JAX** | ✅ 原生 | ⚠️ 实验性 | ROCm 后端尚不完善 |
| **Transformers (HF)** | ✅ 原生 | ✅ 透明兼容 | 用 PyTorch 后端，自动适配 |
| **sentence-transformers** | ✅ | ✅ | 无任何代码差异 |
| **FlagEmbedding** | ✅ | ✅ | 无任何代码差异 |
| **vLLM** | ✅ 一等公民 | ✅ 官方支持 | ROCm 路径文档完整 |
| **llama.cpp** | ✅ (cuBLAS) | ✅ (HIP/hipBLAS) | 编译时 `-DGGML_HIP=ON` |
| **TGI (HF)** | ✅ | ✅ | 官方 ROCm 镜像 |
| **Ollama** | ✅ | ✅ | 自带 ROCm 二进制 |
| **TensorRT-LLM** | ✅ | ❌ | NVIDIA 独家 |
| **flash-attention** | ✅ 主线 | ⚠️ `flash-attn-rocm` fork | 主线 v3 仅 H100 |
| **xformers** | ✅ | ⚠️ 部分算子 | 推荐用 PyTorch SDPA 代替 |
| **bitsandbytes** (4/8bit) | ✅ 完善 | ⚠️ 实验性 ROCm fork | 量化训练受限 |
| **unsloth** (高速微调) | ✅ | ⚠️ 社区 fork | 主线只支持 NVIDIA |
| **DeepSpeed** | ✅ | ✅ | ZeRO 全支持 |
| **Triton** (GPU kernel DSL) | ✅ | ✅ | ROCm 后端已 GA |
| **TorchAO** (新一代量化) | ✅ | ✅ | 跨平台首选 |

---

## 三、安装流程对比（Ubuntu 24.04）

### 3.1 CUDA 安装流程

```bash
# 1. 装 NVIDIA 驱动（推荐用 ubuntu-drivers 自动选）
sudo ubuntu-drivers autoinstall
sudo reboot

# 2. 验证驱动
nvidia-smi   # 看到卡名 + CUDA 版本（这是驱动支持的最高版本）

# 3. 装 PyTorch（自带 CUDA runtime，不需单独装 CUDA Toolkit）
python -m venv ~/.venv/cuda-rag
source ~/.venv/cuda-rag/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu124

# 4. 验证
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

**步骤数**：4 步
**时间**：~15-30 分钟
**痛点**：驱动版本要和 CUDA Toolkit 兼容（PyTorch wheel 自带 runtime，省了大半麻烦）

### 3.2 ROCm 安装流程

```bash
# 1. 装 ROCm 仓库（去 repo.radeon.com 找最新版）
wget https://repo.radeon.com/amdgpu-install/7.2.1/ubuntu/noble/amdgpu-install_7.2.60201-1_all.deb
sudo apt install ./amdgpu-install_7.2.60201-1_all.deb

# 2. 装 ROCm 运行时（5-10 GB）
sudo amdgpu-install --usecase=rocm --no-dkms

# 3. 用户加组（关键步骤，CUDA 不需要）
sudo usermod -aG render,video $USER
sudo reboot

# 4. 验证 ROCm
rocminfo | grep -E "Name|gfx"
rocm-smi

# 5. 装 PyTorch（注意 index-url 不一样）
python -m venv ~/.venv/rocm-rag
source ~/.venv/rocm-rag/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/rocm6.2

# 6. 验证（注意：仍是 torch.cuda.xxx）
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# 期望输出: True AMD Radeon RX 9070 XT
```

**步骤数**：6 步
**时间**：~1-2 小时（包含 5GB 下载）
**痛点**：硬件白名单（GPU 是否被支持）、用户组权限、ROCm 与 PyTorch wheel 版本对齐

### 3.3 关键差异

| 维度 | CUDA | ROCm |
|---|---|---|
| **驱动包** | 一个 `.deb`，自动 | DKMS 或 in-tree，需选择 |
| **运行时下载量** | 0（PyTorch wheel 自带） | 5-10 GB（独立 apt 包） |
| **用户组要求** | 无 | 必须加入 `render`+`video` |
| **硬件支持** | RTX 20 系起几乎全支持 | 白名单（7900/9070/MI 系列等） |
| **OS 支持** | Ubuntu/RHEL/Debian/Arch 广泛 | Ubuntu/RHEL/SLES 官方；其他需折腾 |
| **WSL2 支持** | ✅ 一级公民 | ⚠️ 实验性，性能折损 |
| **多卡** | NVLink + NCCL 稳定 | Infinity Fabric + RCCL（消费卡多卡差） |

---

## 四、代码层对比（精彩之处：几乎无差别）

### 4.1 设备检测

```python
# ✅ 两边完全相同
import torch

print(torch.cuda.is_available())          # CUDA: True / ROCm: True
print(torch.cuda.device_count())          # 一致
print(torch.cuda.get_device_name(0))      # NVIDIA: "RTX 4090" / AMD: "Radeon RX 9070 XT"
print(torch.version.cuda)                 # NVIDIA: "12.4" / AMD: None
print(torch.version.hip)                  # NVIDIA: None / AMD: "6.2.41134-..."
```

**唯一可以区分的方法**：`torch.version.hip` 是否为 None。

### 4.2 张量运算

```python
# ✅ 完全相同
device = 'cuda'  # 在 AMD 上也是 'cuda'，HIP 兼容层让这个字符串都不用改
x = torch.randn(1024, 1024, device=device, dtype=torch.float16)
y = torch.matmul(x, x.T)
```

### 4.3 BGE 模型推理

```python
# ✅ 完全相同
from FlagEmbedding import FlagModel, FlagReranker

embedder = FlagModel('BAAI/bge-m3', use_fp16=True, devices='cuda:0')
vecs = embedder.encode(['hello', '你好'])

reranker = FlagReranker('BAAI/bge-reranker-v2-m3', use_fp16=True, devices='cuda:0')
scores = reranker.compute_score([['熊猫', '大熊猫是中国动物']])
```

> 💡 **要点**：FlagEmbedding / sentence-transformers / transformers 这些库，AMD 上**字面意义零修改**。

### 4.4 vLLM 部署

```bash
# CUDA 路径
pip install vllm
python -m vllm.entrypoints.openai.api_server --model BAAI/bge-m3

# ROCm 路径
# 用官方 ROCm 镜像（强烈推荐，避免编译）
docker run --device=/dev/kfd --device=/dev/dri --group-add video \
  -p 8000:8000 \
  rocm/vllm:latest \
  --model BAAI/bge-m3
```

**差别**：vLLM 在 ROCm 上推荐用 Docker 镜像（避免编译依赖），CUDA 直接 `pip install`。

### 4.5 llama.cpp 编译

```bash
# CUDA
cmake -B build -DGGML_CUDA=ON
cmake --build build -j

# ROCm
cmake -B build -DGGML_HIP=ON -DAMDGPU_TARGETS=gfx1201
cmake --build build -j
```

**差别**：ROCm 要指定 GPU 架构（`gfx1100` for 7900 XTX, `gfx1201` for 9070 XT, `gfx942` for MI300）。

---

## 五、推理框架完整对比

### 5.1 主流推理框架支持矩阵

| 框架 | CUDA | ROCm | 推荐场景 |
|---|---|---|---|
| **Transformers 直接 .generate()** | ⭐⭐⭐ | ⭐⭐⭐ | 原型验证 |
| **vLLM** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 高吞吐 LLM 服务 |
| **SGLang** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | RadixAttention KV 共享 |
| **TGI** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | HF 全家桶集成 |
| **llama.cpp / Ollama** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 消费卡/CPU 量化推理 |
| **TensorRT-LLM** | ⭐⭐⭐⭐⭐ | ❌ | NVIDIA 独家最优 |
| **MLC-LLM** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 跨平台编译 |
| **Triton Inference Server** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 企业级多模型 |
| **TorchServe** | ⭐⭐⭐ | ⭐⭐⭐ | PyTorch 原生 |

### 5.2 vLLM ROCm vs CUDA 实测差异（社区报告）

| 模型 | CUDA (A100 80GB) | ROCm (MI300X 192GB) | ROCm (RX 7900 XTX) |
|---|---|---|---|
| Llama-3.1-8B | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ (大显存赢) | ⭐⭐⭐ (24GB 受限) |
| Llama-3.1-70B | ⭐⭐⭐⭐ (多卡) | ⭐⭐⭐⭐⭐ (单卡) | ❌ (显存不够) |
| Mixtral-8x7B | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Embedding (bge-m3) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**结论**：embedding/reranker 这种"小模型 + 高吞吐"场景，AMD 卡（哪怕消费卡）和 NVIDIA 几乎无差别。

---

## 六、量化与高级特性对比

### 6.1 量化方案支持

| 量化方法 | CUDA | ROCm | 备注 |
|---|---|---|---|
| **GGUF** (llama.cpp) | ✅ | ✅ | 跨平台最稳，CPU+GPU 混合推理 |
| **AWQ** | ✅ | ✅ (vLLM/AutoAWQ) | 推理优化 |
| **GPTQ** | ✅ | ✅ | 老牌方案 |
| **bitsandbytes 8bit** | ✅ 完善 | ⚠️ fork 实验性 | 训练用 |
| **bitsandbytes 4bit (QLoRA)** | ✅ 完善 | ⚠️ fork 不稳定 | QLoRA 微调 |
| **TorchAO** | ✅ | ✅ | PyTorch 官方，跨平台 |
| **FP8 (H100/MI300)** | ✅ Hopper | ✅ MI300 | 消费卡都不支持 |

**结论**：
- **推理量化**：CUDA/ROCm 基本对等（GGUF/AWQ/GPTQ 都能用）
- **量化训练（QLoRA）**：CUDA 优势明显，AMD 需要折腾

### 6.2 Attention 实现

| 实现 | CUDA | ROCm | 备注 |
|---|---|---|---|
| **PyTorch SDPA** | ✅ | ✅ | 默认，跨平台首选 |
| **Flash Attention v2** | ✅ 主线 | ⚠️ `flash-attn-rocm` fork | RDNA3+ 可用 |
| **Flash Attention v3** | ✅ H100 only | ❌ | NVIDIA Hopper 独家 |
| **xFormers memory-efficient** | ✅ | ⚠️ 部分 | 推荐用 SDPA 代替 |
| **Triton flash attention** | ✅ | ✅ | 跨平台首选（如果不嫌慢） |

**实用建议**：对 BGE/Reranker 这种 ≤1B 模型，**用默认 SDPA 即可**，无需 flash-attn。

---

## 七、监控与调试工具对比

| 任务 | CUDA | ROCm |
|---|---|---|
| **看 GPU 利用率** | `nvidia-smi` / `nvtop` | `rocm-smi` / `nvtop`（支持 AMD）/ `radeontop` |
| **持续监控** | `watch -n 1 nvidia-smi` | `watch -n 1 rocm-smi` |
| **显存详情** | `nvidia-smi --query-gpu=memory.used --format=csv` | `rocm-smi --showmeminfo vram` |
| **进程级 GPU 占用** | `nvidia-smi pmon` | `rocm-smi --showpids` |
| **性能分析** | Nsight Systems / Compute | rocprof / Omnitrace |
| **调试器** | cuda-gdb | rocgdb |
| **内存检查** | compute-sanitizer | rocm-sanitizer |

> 💡 `nvtop` **两边都支持**，是跨平台 GPU 监控的瑞士军刀。

---

## 八、Docker / 容器化对比

### 8.1 启动命令

```bash
# CUDA（需 nvidia-container-toolkit）
docker run --gpus all -it nvidia/cuda:12.4.1-runtime-ubuntu22.04

# ROCm（不需要特殊 runtime，靠 device passthrough）
docker run --device=/dev/kfd --device=/dev/dri \
           --group-add video \
           -it rocm/rocm-terminal:latest
```

### 8.2 官方镜像

| 用途 | CUDA 镜像 | ROCm 镜像 |
|---|---|---|
| **基础运行时** | `nvidia/cuda:12.4-runtime` | `rocm/dev-ubuntu-24.04` |
| **PyTorch** | `pytorch/pytorch:2.5-cuda12.4` | `rocm/pytorch:latest` |
| **vLLM** | `vllm/vllm-openai:latest` | `rocm/vllm:latest` |
| **TGI** | `ghcr.io/huggingface/text-generation-inference:latest` | `ghcr.io/huggingface/text-generation-inference:latest-rocm` |

---

## 九、典型痛点对照

| 痛点 | CUDA | ROCm |
|---|---|---|
| **驱动版本不匹配** | 用户态 CUDA Toolkit > 驱动支持 → 报错 | ROCm 版本要严格匹配硬件代际 |
| **wheel 不存在** | 极少（NVIDIA 全代际支持） | 较常见（特别是新卡刚发售时） |
| **没权限访问 GPU** | 罕见（自动配置） | 常见（忘加 render/video 组） |
| **某个库不支持** | 几乎不会 | flash-attn 主线、bitsandbytes、xformers |
| **OS 不支持** | 几乎不会 | Arch/Gentoo/Fedora 需要折腾 |
| **WSL 性能** | ✅ 接近原生 | ⚠️ 折损 20-40% |
| **多卡互联** | NVLink 稳定 | 消费卡跨卡通信慢 |
| **冷启动慢** | cuDNN benchmark | MIOpen kernel 编译（首次特别慢） |
| **生态文档** | ★★★★★ | ★★★ |
| **Stack Overflow 答案密度** | ★★★★★ | ★★ |

---

## 十、典型流程对比图

### 10.1 CUDA 部署 embedding 服务（happy path）

```
[买 NVIDIA 卡] → [装驱动] → [pip install torch+cu] → [pip install FlagEmbedding]
                                                              ↓
                                                       [跑 BGE 推理] ✅
                                                       ~ 30 分钟
```

### 10.2 ROCm 部署 embedding 服务（happy path）

```
[确认 GPU 在白名单] → [装 ROCm 7.2.1] → [加 render/video 组]
                                              ↓
[rocminfo 验证] → [pip install torch+rocm6.2] → [pip install FlagEmbedding]
                                                          ↓
                                                   [跑 BGE 推理] ✅
                                                   ~ 90 分钟
```

### 10.3 ROCm 不顺利路径（消费卡 + 新硬件 + 特殊库）

```
[ROCm 装好] → [PyTorch wheel 索引 403] → [挂代理/换镜像]
                                              ↓
[需要 bitsandbytes] → [主线不支持] → [找 ROCm fork] → [编译失败] → [改用 GGUF]
                                              ↓
[需要 flash-attn] → [主线不支持] → [用 flash-attn-rocm fork] → 或回退 SDPA
                                              ↓
                                       [终于跑起来] ✅
                                       ~ 半天到 1 天
```

---

## 十一、决策树：你该选哪条路？

```
你要做什么？
│
├── 纯推理（embedding / reranker / LLM inference）
│   ├── 已有 NVIDIA 卡 → CUDA ✅ 最省心
│   ├── 已有 AMD 7900/9070/MI300 → ROCm ✅ 完全可行
│   ├── 准备新购 → 看预算：
│   │   ├── 单卡 ≤ 16GB → 价格优先选 AMD (9070 XT)
│   │   ├── 单卡 24GB → 7900 XTX (AMD) vs 4090 (NVIDIA) 性价比相当
│   │   └── 数据中心 → MI300X 192GB vs H100/H200，AMD 显存优势大
│   └── 多卡训练/推理 → CUDA + NVLink 仍是首选
│
├── 微调（PEFT / LoRA / 全参）
│   ├── LoRA / 全参微调（不用 4bit） → 两边都行
│   ├── QLoRA（4bit 量化训练） → CUDA ✅ 强烈推荐
│   └── RLHF / DPO / GRPO → CUDA ✅ 生态更完善
│
├── 研究 / 论文复现
│   ├── 大多数 GitHub 仓库默认 CUDA → CUDA ✅
│   └── 复现工作量小 → ROCm 也行，但常踩坑
│
└── 企业生产部署
    ├── 已有 NVIDIA 基建 → CUDA
    ├── 成本敏感 + 推理为主 → ROCm + MI300 性价比赢
    └── 需 TensorRT 极致优化 → CUDA only
```

---

## 十二、给 Damon 的最终建议（基于你的研究方向）

### 你的画像
- **研究方向**：Agentic AI 企业工程化 + 自然语言语义聚类
- **典型任务**：跑 BGE/Reranker、做语义聚类、构建 RAG、写论文
- **硬件**：Radeon RX 9070 XT（16GB, RDNA 4, gfx1201）
- **OS**：WSL 或 Linux

### 推荐策略

| 任务 | 推荐方案 | 原因 |
|---|---|---|
| **embedding / reranker 推理** | ✅ ROCm + 9070 XT 物理 Linux | 100% 适用，零踩坑 |
| **本地 7B LLM 推理** | ✅ ROCm + vLLM/llama.cpp | 16GB 紧但够，GGUF 是甜点 |
| **语义聚类 (HDBSCAN/UMAP)** | ✅ 任意（CPU 为主） | 算法跑 CPU，GPU 只算 embedding |
| **PEFT 微调 BGE** | ✅ ROCm 可跑（无 bitsandbytes） | 不需要 4bit 量化训练 |
| **QLoRA 微调 7B** | ❌ ROCm 受限 | 建议租云端 NVIDIA 卡 |
| **论文 baseline 复现** | ⚠️ 看仓库 | 多数仓库 CUDA-only，ROCm 可能要改代码 |

### 一句话总结你的情况

> **9070 XT + ROCm 7.2 + Linux 物理机 = embedding/reranker 推理的甜点配置**。需要 QLoRA / flash-attn-v3 时再租云端 NVIDIA，**完全没必要为这两个特例放弃 AMD**。

---

## 十三、关键命令速查表

### CUDA 速查

```bash
nvidia-smi                          # 看卡 + 显存 + 进程
nvidia-smi --query-gpu=name --format=csv  # 只看卡名
nvtop                               # 持续监控
nvcc --version                      # CUDA Toolkit 版本
python -c "import torch; print(torch.version.cuda)"  # PyTorch 用的 CUDA 版本
```

### ROCm 速查

```bash
rocminfo | grep "Marketing Name"   # 看卡名
rocminfo | grep gfx                 # 看架构（gfx1201 = RDNA 4）
rocm-smi                            # 持续监控
rocm-smi --showmeminfo vram        # 看显存
rocm-smi --showtopo                # 看多卡拓扑
nvtop                               # 同样支持 AMD
hipcc --version                     # HIP 编译器版本
python -c "import torch; print(torch.version.hip)"   # PyTorch 用的 HIP 版本
```

### 通用速查

```bash
# 看 GPU 进程占用（两边都用）
fuser -v /dev/nvidia*       # NVIDIA
fuser -v /dev/kfd /dev/dri/* # AMD

# PyTorch 设备信息
python -c "
import torch
print('Available:', torch.cuda.is_available())
print('Count:', torch.cuda.device_count())
print('Name:', torch.cuda.get_device_name(0))
print('CUDA:', torch.version.cuda)
print('HIP:', torch.version.hip)
print('VRAM:', torch.cuda.get_device_properties(0).total_memory / 1e9, 'GB')
"
```

---

## 十四、口诀（速记）

> **API 一样，wheel 不同。** （`torch.cuda.*` 在 AMD 上也是合法的）
> **HIP 翻译 CUDA，编译产物原生 AMD。** （不经过 CUDA runtime）
> **推理跨平台一致，训练 NVIDIA 仍王。**
> **bitsandbytes / flash-attn 是 ROCm 痛点，GGUF / AWQ / SDPA 是 ROCm 甜点。**
> **白名单 + 用户组 + 版本对齐 = ROCm 三大坑。**
> **物理 Linux > Docker > WSL2，性能依次递减。**

---

## 十五、参考链接

1. **ROCm 官方兼容矩阵**：https://rocm.docs.amd.com/en/latest/compatibility/compatibility-matrix.html
2. **ROCm on Radeon 支持矩阵**：https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/compatibility/compatibilityrad/native_linux/native_linux_compatibility.html
3. **PyTorch ROCm 安装**：https://pytorch.org/get-started/locally/
4. **vLLM ROCm 部署文档**：https://docs.vllm.ai/en/latest/getting_started/amd-installation.html
5. **HIP Programming Guide**：https://rocm.docs.amd.com/projects/HIP/en/latest/
6. **9070 XT ROCm 实测**：kaeru.my/notes/local-ai-with-amd-radeon-9070-xt-on-ubuntu-linux-25-04-with-rocm-6-4.1
7. **AMD ROCm 7.2 Consumer GPUs**：dev.to/kunal_d6a8fea2309e1571ee7/amd-rocm-on-consumer-gpus-1cn5

---

## 十六、相关文档

- [reranker-models-comparison.md](reranker-models-comparison.md) — Reranker 模型对比
- [embedding-models-comparison.md](embedding-models-comparison.md) — Embedding 模型对比
- [vllm-sglang-tilelang-comparison.md](vllm-sglang-tilelang-comparison.md) — vLLM/SGLang/TileLang 推理框架对比
