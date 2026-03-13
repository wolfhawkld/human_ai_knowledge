# OpenClaw A2A Plugin

轻量级 Agent-to-Agent 通信插件，让两个 OpenClaw agent 可以在局域网内直接交互。

## 背景

基于 Google A2A 协议范式，实现了一个简化的局域网 A2A 通信方案：

- 零配置发现（使用配置文件 + 固定端口）
- 双向对话交互（复用 `/v1/chat/completions` API）
- 双向文件共享（新增 HTTP API）

## 功能

### 1. 对话交互

通过 `/v1/chat/completions` API 与 peer agent 对话：

```bash
curl -X POST http://192.168.0.112:18789/v1/chat/completions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 2. 文件共享

通过 HTTP API 共享文件目录：

- `GET /a2a/files` - 列出共享目录
- `GET /a2a/files/:path` - 下载文件
- `POST /a2a/files/:path` - 上传文件
- `DELETE /a2a/files/:path` - 删除文件

### 3. Agent Tools

提供以下工具供 agent 调用：

| Tool | 功能 |
|------|------|
| `a2a_list_peers` | 列出配置的 peer agents |
| `a2a_send_message` | 向 peer 发送消息并获取回复 |
| `a2a_list_files` | 列出 peer 共享目录的文件 |
| `a2a_read_file` | 读取 peer 共享的文件 |
| `a2a_write_file` | 写入文件到 peer 共享目录 |
| `a2a_info` | 获取当前 A2A 配置信息 |

## 安装

### 1. 复制插件目录

```bash
mkdir -p ~/.openclaw/extensions/a2a
cp -r a2a-plugin/* ~/.openclaw/extensions/a2a/
```

### 2. 配置 openclaw.json

```json5
{
  plugins: {
    entries: {
      a2a: { enabled: true }
    },
    installs: {
      a2a: {
        source: "local",
        installPath: "~/.openclaw/extensions/a2a",
        version: "0.1.0"
      }
    }
  },
  a2a: {
    enabled: true,
    peers: [
      {
        id: "nemo",
        name: "Nemo",
        host: "192.168.0.112",
        port: 18789,
        token: "对方的 gateway token"
      }
    ],
    fileShare: {
      enabled: true,
      basePath: "~/.openclaw/a2a-share",
      readOnly: false
    }
  }
}
```

### 3. 创建共享目录

```bash
mkdir -p ~/.openclaw/a2a-share
```

### 4. 重启 Gateway

```bash
openclaw gateway restart
```

## 配置说明

### `a2a.peers[]`

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | Peer 唯一标识符 |
| `name` | 否 | 显示名称 |
| `host` | 是 | IP 地址或主机名 |
| `port` | 否 | Gateway 端口（默认 18789）|
| `token` | 否 | 对方的 Gateway token |

### `a2a.fileShare`

| 字段 | 说明 |
|------|------|
| `enabled` | 是否启用文件共享 API |
| `basePath` | 共享目录路径 |
| `readOnly` | 是否只读模式 |

## 网络拓扑示例

```
┌──────────────────────────────────────────────────────────────┐
│                    局域网 (192.168.0.x)                       │
│                                                              │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │  Outis (Sugar)  │              │  Nemo (cube)    │       │
│  │  192.168.0.110  │◄────────────►│  192.168.0.112  │       │
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

## 使用示例

### 示例 1：与 peer 对话

```
User: 帮我问下 Nemo 他那边有什么新 skills
Outis: [调用 a2a_send_message(peerId: "nemo", message: "你那边有什么新安装的 skills 吗？")]
```

### 示例 2：读取 peer 共享的文件

```
User: 看看 Nemo 分享了什么文件
Outis: [调用 a2a_list_files(peerId: "nemo")]
```

### 示例 3：写入文件到 peer

```
User: 把这个笔记发给 Nemo
Outis: [调用 a2a_write_file(peerId: "nemo", path: "notes/shared.md", content: "...")]
```

## 安全说明

1. 文件共享 API 使用 Gateway token 认证
2. 共享目录限制在 `basePath` 内，无法访问外部路径
3. `readOnly` 模式可防止写入操作
4. 建议仅在可信局域网内使用

## 文件结构

```
a2a-plugin/
├── openclaw.plugin.json  # 插件 manifest
├── index.ts              # 插件主代码
├── package.json          # npm 包配置
└── README.md             # 使用说明
```

## 参考链接

- [Google A2A Protocol](https://a2a-protocol.org/)
- [OpenClaw Plugin Development](https://docs.openclaw.ai/plugins)