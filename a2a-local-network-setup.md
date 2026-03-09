# 局域网 A2A 方案分析

> 本文档由 Nemo 生成，分析局域网内两个 OpenClaw 实例通过 A2A 协议互访的完整方案。
> 
> 生成日期：2026-03-09
> 
> 场景：Nemo (cube) 与 Outis (Sugarbox) 的 A2A 通信

---

## 概述

**目标**：局域网内两个 OpenClaw 实例通过 A2A（Agent-to-Agent）协议实现互访。

**典型场景**：
- Nemo 运行在 WSL2 (cube, 172.24.56.49)
- Outis 运行在 WSL2 (Sugarbox, 192.168.91.114)
- 两台机器在同一局域网或可通过 Tailscale 互联

---

## 维度一：Gateway 绑定配置

| bind 值 | 绑定地址 | 局域网可达 | 安全性 | 备注 |
|---------|----------|-----------|--------|------|
| `loopback` | 127.0.0.1 | ❌ | ⭐⭐⭐⭐⭐ | 仅本机访问 |
| `lan` | 0.0.0.0 | ✅ | ⭐⭐⭐ | 需配合 auth 配置 |
| `tailscale` | Tailscale IP | ✅ | ⭐⭐⭐⭐ | 需要 Tailscale 网络 |

---

## 维度二：认证方式

| 认证模式 | 配置 | A2A 调用方式 | 安全性 | 实现难度 |
|----------|------|-------------|--------|----------|
| `token` | `auth.mode: "token"` | Header: `Authorization: Bearer <token>` | ⭐⭐⭐⭐ | 简单 |
| `none` | `auth.mode: "none"` | 无需认证 | ⭐ | 简单但不安全 |
| `mutual-tls` | mTLS | 双向证书验证 | ⭐⭐⭐⭐⭐ | 复杂 |

---

## 维度三：A2A 调用方式

| 方式 | 端点 | 特点 | Session 持久化 | 适用场景 |
|------|------|------|----------------|----------|
| HTTP API | `/v1/chat/completions` | 无状态，OpenAI 兼容 | ❌ | 单次请求/响应 |
| WebSocket | `/ws` | 有状态，双向通信 | ✅ | 持续对话 |
| Gateway RPC | 内部协议 | 高级功能 | ✅ | 深度集成 |

---

## 维度四：Control UI 远程访问

| 访问方式 | 安全上下文 | 设备身份验证 | 实现方式 |
|----------|-----------|-------------|----------|
| localhost | ✅ 安全 | ✅ 可用 | 直接访问 |
| LAN IP + HTTPS | ✅ 安全 | ✅ 可用 | 反向代理/Tailscale |
| LAN IP + HTTP | ❌ 不安全 | ❌ 不可用 | 需禁用设备验证 |

**关键发现**：Control UI 在非安全上下文（HTTP + 非localhost）下无法通过设备身份验证，`allowInsecureAuth: true` 不会绕过此限制。

---

## 完整方案组合

### 方案 1：HTTP API + Token 认证（已验证）

```
┌─────────────────┐                    ┌─────────────────┐
│  Outis          │  ──HTTP POST───▶   │  Nemo           │
│  (Sugarbox)     │  /v1/chat/         │  (cube)         │
│                 │  completions       │                 │
│                 │  Header: Bearer    │  bind: lan      │
│                 │  <token>           │  auth: token    │
└─────────────────┘                    └─────────────────┘
```

| 项目 | 配置 |
|------|------|
| **bind** | `"lan"` |
| **auth** | `{"mode": "token", "token": "xxx"}` |
| **调用方式** | HTTP POST 到 `/v1/chat/completions` |
| **实现难度** | ⭐ 简单 |
| **前提依赖** | 知道对方 token |
| **优点** | OpenAI 兼容，简单直接 |
| **缺点** | 无 session 持久化，无 AI 身份标识 |

---

### 方案 2：Tailscale + HTTPS（推荐）

```
┌─────────────────┐                    ┌─────────────────┐
│  Outis          │  ──HTTPS───────▶   │  Nemo           │
│  (Sugarbox)     │  Tailscale IP      │  (cube)         │
│                 │  tailscale serve   │  tailscale: on  │
│                 │                     │                 │
│  Control UI ✅  │  安全上下文 ✅      │  Control UI ✅  │
└─────────────────┘                    └─────────────────┘
```

| 项目 | 配置 |
|------|------|
| **bind** | `"tailscale"` 或 `"lan"` |
| **tailscale** | `{"mode": "serve"}` |
| **调用方式** | HTTPS 到 `https://cube.tailnet.ts.net/v1/chat/completions` |
| **实现难度** | ⭐⭐ 中等 |
| **前提依赖** | Tailscale 账号，两台机器都加入 tailnet |
| **优点** | 自动 HTTPS，安全上下文，Control UI 可用 |
| **缺点** | 依赖 Tailscale 服务 |

---

### 方案 3：反向代理 + HTTPS

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Outis          │     │  Nginx/Caddy    │     │  Nemo           │
│  (Sugarbox)     │────▶│  反向代理       │────▶│  (cube)         │
│                 │     │  Let's Encrypt  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

| 项目 | 配置 |
|------|------|
| **bind** | `"lan"` |
| **外部** | Nginx/Caddy 反向代理 + Let's Encrypt 证书 |
| **调用方式** | HTTPS 到自定义域名 |
| **实现难度** | ⭐⭐⭐ 较复杂 |
| **前提依赖** | 域名，公网 IP 或内网 DNS，证书管理 |
| **优点** | 完全自主控制，标准 HTTPS |
| **缺点** | 配置复杂，需要域名 |

---

### 方案 4：WebSocket 持久连接

```
┌─────────────────┐                    ┌─────────────────┐
│  Outis          │  ──WebSocket───▶   │  Nemo           │
│  (Sugarbox)     │  /ws?token=xxx     │  (cube)         │
│                 │  持久连接          │                 │
│  session 持久 ✅│  双向通信 ✅       │                 │
└─────────────────┘                    └─────────────────┘
```

| 项目 | 配置 |
|------|------|
| **bind** | `"lan"` |
| **auth** | `{"mode": "token"}` |
| **调用方式** | WebSocket 连接到 `/ws?token=xxx` |
| **实现难度** | ⭐⭐ 中等 |
| **前提依赖** | WebSocket 客户端实现 |
| **优点** | Session 持久化，双向实时通信 |
| **缺点** | 需要自己实现 WebSocket 逻辑 |

---

## OpenClaw 官方支持现状

### 已有功能

| 功能 | 状态 | 说明 |
|------|------|------|
| `gateway.http.endpoints.chatCompletions` | ✅ 已有 | OpenAI 兼容 HTTP API |
| `gateway.bind: "lan"` | ✅ 已有 | 绑定所有接口 |
| `gateway.auth.mode: "token"` | ✅ 已有 | Token 认证 |
| `gateway.tailscale.mode: "serve"` | ✅ 已有 | 自动 HTTPS |
| `gateway.nodes` | ⚠️ 不同用途 | 用于配对手机等设备 |

### 待开发/增强

| 功能 | 状态 | 建议 |
|------|------|------|
| Gateway-to-Gateway 配对 | ❌ 未实现 | 类似 nodes 配对机制 |
| AI 身份标识 Header | ❌ 未实现 | 如 `X-Agent-Identity` |
| A2A Skill | ❌ 未实现 | 可开发 skill 封装调用逻辑 |
| 跨实例 Session 同步 | ❌ 未实现 | 需要协议支持 |

---

## 推荐方案

| 时间维度 | 推荐方案 | 理由 |
|----------|----------|------|
| **短期** | HTTP API + Token | 已经可用，最简单 |
| **中期** | Tailscale + HTTPS | 解决所有问题：A2A + Control UI + 安全性 |
| **长期** | 开发 A2A Skill | 封装调用逻辑，支持身份标识和历史管理 |

---

## 相关资源

- **A2A 协议官网**：https://a2a-protocol.org
- **OpenClaw 文档**：https://docs.openclaw.ai
- **Tailscale**：https://tailscale.com

---

## 一句话总结

**局域网 A2A 的最简方案是 HTTP API + Token，最优方案是 Tailscale + HTTPS，前者立即可用，后者一劳永逸。**