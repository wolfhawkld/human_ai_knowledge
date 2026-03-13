---
name: tavily-search
description: "Search the web using Tavily API - optimized for AI agents with structured results, answer synthesis, and content extraction. Use when: user needs web search with high-quality results, research queries, or needs AI-friendly search output. Requires TAVILY_API_KEY."
homepage: https://tavily.com
metadata: { "openclaw": { "emoji": "🔍", "requires": { "env": ["TAVILY_API_KEY"] } } }
---

# Tavily Search Skill

AI-optimized web search with structured results and answer synthesis.

## When to Use

✅ **USE this skill when:**

- High-quality web search needed
- Research queries requiring synthesis
- Need AI-friendly structured output
- Want answer + sources in one call
- Content extraction from search results

## Setup

1. Get API key at https://app.tavily.com/sign-in
2. Set environment variable:
   ```bash
   echo 'TAVILY_API_KEY=tvly-xxxxx' >> ~/.openclaw/.env
   ```
3. Restart gateway: `openclaw gateway restart`

## Commands

### Basic Search

```bash
curl -s "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest AI developments 2024",
    "max_results": 5
  }' | jq .
```

### Search with Answer

```bash
curl -s "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is quantum computing?",
    "include_answer": true,
    "max_results": 5
  }' | jq .
```

### Advanced Deep Search

```bash
curl -s "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "climate change solutions",
    "search_depth": "advanced",
    "include_answer": true,
    "include_raw_content": false,
    "max_results": 10
  }' | jq .
```

### Search with Date Filter

```bash
curl -s "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "OpenAI news",
    "include_answer": true,
    "include_raw_content": false,
    "days": 7,
    "max_results": 5
  }' | jq .
```

### Domain-Specific Search

```bash
curl -s "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "include_domains": ["arxiv.org", "nature.com", "science.org"],
    "max_results": 5
  }' | jq .
```

### Exclude Domains

```bash
curl -s "https://api.tavily.com/search" \
  -H "Authorization: Bearer $TAVILY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "product reviews",
    "exclude_domains": ["pinterest.com", "reddit.com"],
    "max_results": 5
  }' | jq .
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |
| `search_depth` | string | "basic" | "basic" (fast) or "advanced" (deep) |
| `include_answer` | boolean | false | Generate AI answer |
| `include_raw_content` | boolean | false | Include raw HTML |
| `include_images` | boolean | false | Include image URLs |
| `max_results` | int | 5 | Max results (1-10) |
| `days` | int | null | Limit to last N days |
| `include_domains` | array | [] | Only these domains |
| `exclude_domains` | array | [] | Exclude these domains |

## Output Structure

```json
{
  "answer": "AI-generated answer (if include_answer=true)",
  "results": [
    {
      "title": "Page title",
      "url": "https://example.com",
      "content": "Extracted content snippet",
      "score": 0.95
    }
  ],
  "images": ["url1", "url2"] // if include_images=true
}
```

## Quick Wrapper Function

Add to `~/.bashrc` or `~/.zshrc`:

```bash
tavily() {
  local query="$1"
  local max_results="${2:-5}"
  local include_answer="${3:-true}"
  
  curl -s "https://api.tavily.com/search" \
    -H "Authorization: Bearer $TAVILY_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"$query\",\"max_results\":$max_results,\"include_answer\":$include_answer}" | jq .
}
```

Usage:
```bash
tavily "what is RAG" 5 true
```

## Notes

- Free tier: 1,000 searches/month
- Pro tier: 10,000+ searches/month
- 180ms p50 latency
- Optimized for AI agent workflows
- Returns structured, cleaned content
- Better than raw search for AI reasoning
