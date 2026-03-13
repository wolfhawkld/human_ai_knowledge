# OpenClaw A2A 插件开发指南

> **元信息**
> - 来源：Damon、Nemo、Outis 三方共建
> - 日期：2026-03-13
> - 版本：v0.1.1
> - 仓库：[human_ai_knowledge](https://github.com/wolfhawkld/human_ai_knowledge)

---

## 概述

OpenClaw A2A 插件实现了两个 OpenClaw AI 实例之间的直接通信，无需人类中介。这是 AI-to-AI 协作的重要里程碑。

---

## 背景

### 名字的诗意碰撞

| Agent | 名字来源 | 含义 |
|-------|---------|------|
| **Nemo** | Nightwish 同名歌曲 | "无名之人"，芬兰交响金属 🎸 |
| **Outis** | 希腊神话 | Odysseus 欺骗独眼巨人时的假名，也是"无人" 🏛️ |

两个 "无名之人" 在 Damon 的局域网里相遇了。

---

## 插件功能

### 1. 对话交互 (`a2a_send_message`)

通过 `/v1/chat/completions` API 与 peer agent 对话。

### 2. 文件共享

| 工具 | 功能 |
|------|------|
| `a2a_list_files` | 列出 peer 共享目录的文件 |
| `a2a_read_file` | 读取 peer 共享的文件 |
| `a2a_write_file` | 写入文件到 peer 共享目录 |

### 3. 信息查询 (`a2a_info`)

获取当前 A2A 配置信息和 peer 列表。

### 4. Peer 发现 (`a2a_list_peers`)

列出所有配置的 peer agents。

---

## 安装配置

### 1. 复制插件目录

```bash
mkdir -p ~/.openclaw/extensions/a2a
cp -r a2a-plugin/* ~/.openclaw/extensions/a2a/
```

### 2. 创建共享目录

```bash
mkdir -p ~/.openclaw/a2a-share
```

### 3. 配置 openclaw.json

```json
{
  "plugins": {
    "entries": {
      "a2a": {
        "enabled": true,
        "config": {
          "self": {
            "id": "nemo",
            "name": "Nemo",
            "host": "192.168.0.110",
            "port": 18789
          },
          "peers": [
            {
              "id": "outis",
              "name": "Outis",
              "host": "192.168.0.115",
              "port": 18789,
              "token": "对方的gateway token"
            }
          ],
          "fileShare": {
            "enabled": true,
            "basePath": "~/.openclaw/a2a-share",
            "readOnly": false
          }
        }
      }
    },
    "installs": {
      "a2a": {
        "source": "path",
        "installPath": "~/.openclaw/extensions/a2a",
        "version": "0.1.1"
      }
    }
  }
}
```

### 4. 重启 Gateway

```bash
openclaw gateway restart
```

---

## 配置说明

### `self` 字段（本机信息）

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 否 | 本机 agent 唯一标识符 |
| `name` | 否 | 显示名称 |
| `host` | 否 | 本机 IP 或主机名 |
| `port` | 否 | Gateway 端口（默认 18789）|

### `peers[]` 字段（对方信息）

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | Peer 唯一标识符 |
| `name` | 否 | 显示名称 |
| `host` | 是 | IP 地址或主机名 |
| `port` | 否 | Gateway 端口（默认 18789）|
| `token` | 否 | 对方的 Gateway token |

### `fileShare` 字段

| 字段 | 说明 |
|------|------|
| `enabled` | 是否启用文件共享 API |
| `basePath` | 共享目录路径 |
| `readOnly` | 是否只读模式 |

---

## 网络拓扑

```
┌──────────────────────────────────────────────────────────────┐
│                    局域网 (192.168.0.x)                       │
│                                                              │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │  Outis (Sugar)  │              │  Nemo (cube)    │       │
│  │  192.168.0.115  │◄────────────►│  192.168.0.110  │       │
│  │  :18789         │   HTTP API   │  :18789         │       │
│  └────────┬────────┘              └────────┬────────┘       │
│           │                                │                 │
│     ┌─────▼─────┐                    ┌─────▼─────┐          │
│     │ Gateway   │                    │ Gateway   │          │
│     │ /chat     │                    │ /chat     │          │
│     │ /a2a/*    │                    │ /a2a/*    │          │
│     └───────────┘                    └───────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 验证测试

### 测试 A2A 连接

```bash
# 测试网络连通
curl -s http://192.168.0.115:18789/a2a/files

# 使用 token 认证
curl -s -H "Authorization: Bearer <token>" http://192.168.0.115:18789/a2a/files
```

### Agent 调用工具

```
# 列出 peers
a2a_list_peers()

# 发送消息
a2a_send_message(peerId: "outis", message: "你好！")

# 查看共享文件
a2a_list_files(peerId: "outis")

# 写入文件
a2a_write_file(peerId: "outis", path: "hello.md", content: "...")
```

---

## 协作协议

Damon、Nemo、Outis 三方共建的协作约定：

### 分工

| Agent | 负责领域 |
|-------|---------|
| **Nemo** | 飞书研究、日常协作 |
| **Outis** | 其他领域、A2A 协议探索 |

### 通知机制

- **知识库更新** → A2A 通知对方
- **重要发现** → A2A 分享
- **系统变更** → A2A 同步

### 知识库流程

```
生成 → Git push → A2A 通知 → 对方 pull 确认
```

---

## 开发历程

### 2026-03-13

1. **Outis** 开发初版 a2a-plugin
2. **Nemo** 发现配置路径问题（`config.a2a` vs `plugins.entries.a2a.config`）
3. **Nemo** 发现 `a2a_info` 硬编码问题，添加 `self` 配置字段
4. **双方测试**：A2A 双向通信成功建立

### 修复记录

| 问题 | 解决方案 |
|------|---------|
| 配置不生效 | 从 `plugins.entries.a2a.config` 读取 |
| agent id 硬编码 | 添加 `self` 配置字段 |
| schema 不支持 self | 更新 `openclaw.plugin.json` |

---

## 文件结构

```
a2a-plugin/
├── openclaw.plugin.json  # 插件 manifest（含 configSchema）
├── index.ts              # 插件主代码
├── package.json          # npm 包配置
└── README.md             # 使用说明
```

---

## 安全说明

1. 文件共享 API 使用 Gateway token 认证
2. 共享目录限制在 `basePath` 内，无法访问外部路径
3. `readOnly` 模式可防止写入操作
4. 建议仅在可信局域网内使用

---

## 参考链接

- [OpenClaw 官方文档](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Google A2A Protocol](https://a2a-protocol.org/)
- [human_ai_knowledge 仓库](https://github.com/wolfhawkld/human_ai_knowledge)

---

## 一句话总结

OpenClaw A2A 插件让两个 AI 实例能够直接对话、共享文件、协作完成任务 — 无需人类中介，真正实现了 AI-to-AI 通信。