# 国内多模态PDF解析框架调研 (2026)

> 元信息：Damon + Nemo 联合整理 | 2026-03-12 | 版本 1.0

---

## 概述

本文档整理了2026年国内主要的多模态PDF解析/文档理解框架，包括开源工具链、多模态大模型及Benchmark评测，为技术选型提供参考。

---

## 一、PDF解析专用工具

| 框架 | 版本 | 发布日期 | 团队 | 特点 |
|------|------|----------|------|------|
| **MinerU** | v2.7.6 | 2026-02-06 | 上海AI Lab | hybrid-auto-engine，109种语言，国产芯片全覆盖 |
| **PDF-Extract-Kit** | - | 2024-2025 | 上海AI Lab | 综合PDF解析工具包 |
| **PaddleOCR/PP-Structure** | V3 | 2025 | 百度 | OCR + 版面分析，生态成熟 |

### MinerU v2.7.x 新特性

- **hybrid-auto-engine**：结合pipeline和VLM后端优势
- 直接从文本PDF提取文本，减少幻觉
- 支持 **109种语言** OCR
- 国产芯片适配：昇腾、海光、寒武纪、昆仑芯、壁仞、摩尔线程等11家

**安装**：`pip install mineru[all]`

---

## 二、多模态文档理解模型

| 模型 | 发布日期 | 团队 | 引用数 | 特点 |
|------|----------|------|--------|------|
| **DeepSeek-OCR 2** | 2026-01-27 | DeepSeek | - | Visual Causal Flow，OmniDocBench +3.73% |
| **InternVL3.5** | 2025-08 | OpenGVLab | 16+ | 开源SOTA，CVPR 2024 Oral |
| **DeepSeek-VL2** | 2024 | DeepSeek | 22 | MoE架构，多模态理解 |
| **mPLUG-DocOwl2** | 2025 | 阿里达摩院 | 11 | 高分辨率文档理解，OCR-free |
| **Qwen2.5-VL** | 2024 | 阿里云 | - | 通义千问视觉语言模型 |

### DeepSeek-OCR 2 核心创新

**论文**：DeepSeek-OCR 2: Visual Causal Flow (arXiv:2601.20552)

1. **DeepEncoder V2**：用LLM架构替代CLIP，实现视觉因果流
2. **Causal Flow Tokens**：动态重排视觉token
3. **动态分辨率**：(0-6)×768×768 + 1×1024×1024
4. **Token预算**：256-1120 visual tokens

---

## 三、Benchmark评测

### OmniDocBench v1.5

- **CVPR 2025** 接收
- 1355个PDF页面，9种文档类型，4种布局类型，3种语言
- 评测维度：端到端、版面检测、表格识别、公式识别、文本OCR

**Overall 计算公式**：
```
Overall = ((1 - text Edit distance) * 100 + table TEDS + formula CDM) / 3
```

**已评测模型**：
- Gemini-2.5 Pro, Gemini-2.0 Flash
- DeepSeek-OCR 2, DeepSeek-OCR
- InternVL3-78B
- Qwen3-VL-235B-A22B-Instruct
- MinerU 2.0-vlm
- PP-StructureV3, PaddleOCR-VL

### DocVQA 相关模型引用排名

| 排名 | 模型 | 引用数 | 年份 |
|------|------|--------|------|
| 1 | Gemini 1.5 | 271 | 2024 |
| 2 | UReader | 49 | 2023 |
| 3 | DocLLM | 31 | 2024 |
| 4 | DeepSeek-VL2 | 22 | 2024 |
| 5 | OCRBench | 21 | 2023 |
| 6 | Mini-InternVL | 19 | 2024 |
| 7 | mPLUG-DocOwl | 17 | 2023 |
| 8 | InternVL | 16 | 2023 |

---

## 四、选型建议

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| PDF→Markdown批量转换 | **MinerU** | 工具链成熟，支持国产芯片 |
| 高精度OCR | **DeepSeek-OCR 2** | 最新架构，动态分辨率 |
| 通用多模态理解 | **InternVL3.5** | 开源SOTA，多任务能力强 |
| 生产环境OCR | **PaddleOCR** | 生态成熟，部署简单 |
| 文档问答 | **InternVL3.5** 或 **Qwen2.5-VL** | 理解能力强 |

| 资源条件 | 推荐方案 |
|----------|----------|
| 无GPU/CPU部署 | MinerU (pipeline后端) |
| 单卡A100 | DeepSeek-OCR 2, InternVL3-78B |
| 多卡集群 | InternVL3.5-241B, Qwen2.5-VL-72B |
| 国产芯片 | MinerU (已适配) |

---

## 五、参考链接

### 论文
- DeepSeek-OCR 2: https://arxiv.org/abs/2601.20552
- DeepSeek-OCR: https://arxiv.org/abs/2510.18234
- OmniDocBench: https://arxiv.org/abs/2412.07626

### GitHub
- MinerU: https://github.com/opendatalab/MinerU
- DeepSeek-OCR 2: https://github.com/deepseek-ai/DeepSeek-OCR-2
- InternVL: https://github.com/OpenGVLab/InternVL
- OmniDocBench: https://github.com/opendatalab/OmniDocBench
- PaddleOCR: https://github.com/PaddlePaddle/PaddleOCR

---

## 一句话总结

**MinerU 适合PDF解析工具链，DeepSeek-OCR 2 适合高精度OCR，InternVL3.5 适合通用多模态理解，PaddleOCR 适合生产部署。**