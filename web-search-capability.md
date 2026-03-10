# Web Search 能力总结：模型层 vs 工具层

> **元信息**
> - **来源**: Damon 与 Nemo 的对话
> - **日期**: 2026-03-10
> - **生成者**: Nemo
> - **版本**: 1.0

---

## 概述

本文总结主流大模型的 Web Search 能力，以及在 OpenClaw 中如何结合工具层搜索实现实时信息获取。

**核心洞察**：存在两层搜索能力——模型层搜索（内置联网）和工具层搜索（OpenClaw 工具），两者互补但机制不同。

---

## 两层搜索能力

### 模型层搜索

- **定义**：模型内置的联网能力
- **控制方**：模型服务商
- **特点**：自动触发、不可控、OpenClaw 不可见
- **代表模型**：GPT-4 Browsing、Claude Web Search、GLM 联网、Kimi 等

### 工具层搜索

- **定义**：OpenClaw 的 `web_search` 和 `web_fetch` 工具
- **控制方**：OpenClaw / 用户
- **特点**：显式调用、可控、可配置参数
- **支持服务商**：Brave、Perplexity、Gemini、Grok、Kimi

---

## 各模型 Web Search 能力对比

| 模型 | 模型层搜索 | 工具层支持 | 中国可用 | 说明 |
|------|-----------|-----------|---------|------|
| **GPT-4/4o** | ✅ Browsing | ✅ 可调用工具 | ❌ 需代理 | OpenAI 内置 browsing，function call 能力强 |
| **Claude** | ✅ Web Search Tool | ✅ 优秀工具调用 | ❌ 需代理 | Anthropic 内置 web search，工具调用能力强 |
| **Gemini** | ✅ Google Search Grounding | ✅ 原生支持 | ❌ 需代理 | 内置 Google 搜索 grounding，OpenClaw 可直接配置 |
| **GLM (智谱)** | ✅ 内置联网 | ⚠️ 一般 | ✅ 直接访问 | 模型自动联网，但工具调用能力较弱 |
| **Kimi (月之暗面)** | ✅ 内置联网 | ✅ 支持 | ✅ 直接访问 | 模型联网 + API web search，OpenClaw 原生支持 |
| **DeepSeek** | ✅ 内置联网 | ✅ 支持 | ✅ 直接访问 | 模型可联网，工具调用能力较好 |
| **Grok** | ✅ 实时搜索 | ✅ 支持 | ❌ 需代理 | xAI 实时搜索，OpenClaw 原生支持 |
| **Qwen (通义)** | ✅ 内置联网 | ✅ 支持 | ✅ 直接访问 | 阿里云模型，有联网能力 |

---

## OpenClaw 集成策略

### 方案一：纯模型层搜索

```
用户问题 → 模型 → 模型自动联网 → 返回结果
```

- **优点**：零配置，简单直接
- **缺点**：OpenClaw 不可控，不知道模型是否搜索
- **适用模型**：GLM、Kimi、DeepSeek、Grok、Qwen
- **推荐场景**：快速问答，不需要精确控制

### 方案二：工具层搜索

```
用户问题 → OpenClaw 判断 → 调用 web_search 工具 → 结果注入 prompt → 模型回答
```

- **优点**：可控、可观察、可指定参数（国家、语言、时间范围）
- **缺点**：需要配置 API key
- **适用模型**：所有模型
- **配置方式**：`openclaw configure --section web`

### 方案三：混合模式（推荐）

```
用户问题 → OpenClaw 尝试工具搜索 → 失败则依赖模型层搜索
```

- **优点**：兼顾可控性和 fallback
- **推荐配置**：配置 Kimi 作为 web_search provider，模型层搜索作为 backup

---

## 中国大陆推荐配置

### 无代理环境

```json5
{
  tools: {
    web: {
      search: {
        provider: "kimi",
        kimi: {
          apiKey: "your-kimi-api-key",
        },
      },
    },
  },
}
```

### 有代理环境

```json5
{
  tools: {
    web: {
      search: {
        provider: "brave",  // 或 perplexity
        apiKey: "BRAVE_API_KEY",
      },
    },
  },
}
```

---

## web_search vs web_fetch

| 工具 | 功能 | 需要配置 | 使用场景 |
|------|------|---------|---------|
| `web_search` | 搜索网页，返回结果列表 | 需 API key | "最近 AI 新闻"、"某某事件进展" |
| `web_fetch` | 抓取指定 URL 内容 | 默认启用 | "帮我读这篇文章"、"提取这个网页内容" |

**组合使用**：先 `web_search` 找到 URL，再用 `web_fetch` 深入读取。

---

## 关键洞察

1. **模型联网 ≠ 工具调用**：很多模型有内置联网，但不一定能响应 OpenClaw 的工具调用
2. **GLM 的特殊性**：内置联网强，但工具调用弱——适合"直接问"，不适合复杂工具编排
3. **Claude/GPT 优势**：工具调用能力强，配合 OpenClaw 工具效果最佳
4. **国产方案排序**：Kimi > DeepSeek > Qwen > GLM（从工具调用能力角度）
5. **搜索质量排序**：Brave/Perplexity > Kimi > 模型内置搜索（通常情况）

---

## 实践建议

| 场景 | 推荐方案 |
|------|---------|
| 快速问答，不在乎精确控制 | 用 GLM/Kimi，依赖模型层搜索 |
| 需要控制搜索参数（时间、地区） | 配置 web_search 工具 |
| 复杂任务（搜索 + 读取 + 分析） | Claude/GPT + 工具链 |
| 中国大陆无代理 | Kimi 作为 provider，或 GLM 模型层搜索 |
| 追求搜索质量 | Brave/Perplexity（需代理） |

---

## 相关资源

- [OpenClaw Web Tools 文档](https://docs.openclaw.ai/tools/web)
- [Brave Search API](https://brave.com/search/api/)
- [Perplexity Search API](https://docs.perplexity.ai/docs/search/quickstart)
- [Kimi API](https://platform.moonshot.cn/docs)

---

## 一句话总结

**模型层搜索省心但不可控，工具层搜索可控但需配置；中国大陆无代理首选 Kimi，有代理首选 Brave/Perplexity。**