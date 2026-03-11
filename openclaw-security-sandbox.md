# OpenClaw 安全配置指南：沙箱与文件系统隔离

> 来源：Damon 整理的安全配置实践
> 生成者：Damon
> 日期：2026-03-01（原始），2026-03-11（人机知识化）

---

## 一、背景与目标

将 OpenClaw 部署在 WSL2 Ubuntu 子系统中，需要确保：
1. AI Agent 的操作不会误删或损坏 Ubuntu 系统文件
2. 无法访问或破坏 Windows 文件系统（`/mnt/c/`）
3. 敏感数据（密钥、配置、个人文件）不会被意外泄露

---

## 二、安全配置方案

采用**双层防护架构**：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Windows 主机                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           WSL2 Ubuntu                                  │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     OpenClaw Gateway                             │  │  │
│  │  │  ┌───────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │                 Docker Sandbox Container                   │  │  │  │
│  │  │  │                                                           │  │  │  │
│  │  │  │   ┌─────────────────┐     ┌─────────────────────────┐   │  │  │  │
│  │  │  │   │  /workspace     │ ←── │  ~/.openclaw/workspace  │   │  │  │  │
│  │  │  │   │  (读写挂载)      │     │  (主机目录映射)          │   │  │  │  │
│  │  │  │   └─────────────────┘     └─────────────────────────┘   │  │  │  │
│  │  │  │                                                           │  │  │  │
│  │  │  │   ❌ 无网络访问（默认）                                     │  │  │  │
│  │  │  │   ❌ 无法访问 /mnt/c/ (Windows)                            │  │  │  │
│  │  │  │   ❌ 无法访问 ~/.openclaw/ (配置/密钥)                      │  │  │  │
│  │  │  │   ❌ 无法访问 /root/, /home/ 等系统目录                     │  │  │  │
│  │  │  │                                                           │  │  │  │
│  │  │  └───────────────────────────────────────────────────────────┘  │  │  │
│  │  │                          ↑                                      │  │  │
│  │  │              tools.fs.workspaceOnly: true                       │  │  │
│  │  │              agents.defaults.sandbox.mode: all                  │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                        │  │
│  │  ~/.openclaw/  ← 配置、密钥、会话记录（Agent 可读但受限）               │  │
│  │  /mnt/c/       ← Windows 文件系统（Agent 完全不可见）                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、配置详情

### 3.1 文件系统限制

**配置项：** `tools.fs.workspaceOnly: true`

**生效范围：** `read`、`write`、`edit` 文件操作工具

**权限边界：**
| 路径 | 访问权限 | 说明 |
|------|---------|------|
| `~/.openclaw/workspace/` | ✅ 可读写 | Agent 唯一可操作的文件区域 |
| `~/.openclaw/openclaw.json` | ❌ 禁止访问 | 配置文件（含密钥） |
| `~/.openclaw/credentials/` | ❌ 禁止访问 | 认证凭据存储 |
| `~/.openclaw/agents/` | ❌ 禁止访问 | 会话记录、日志 |
| `/mnt/c/` (Windows) | ❌ 禁止访问 | Windows 文件系统 |
| `/home/*/` | ❌ 禁止访问 | 其他用户目录 |
| `/etc/`, `/var/`, `/root/` | ❌ 禁止访问 | 系统目录 |

### 3.2 Docker 沙箱隔离

**配置项：** `agents.defaults.sandbox.mode: "all"`

**生效范围：** `exec` 命令执行工具

**沙箱镜像：** `openclaw-sandbox:bookworm-slim`

**镜像内容：**
```dockerfile
FROM debian:bookworm-slim
# 预装工具：bash, curl, git, jq, python3, ripgrep
# 创建非特权用户 sandbox
# 默认无网络访问
```

**权限边界：**
| 资源 | 沙箱内状态 | 说明 |
|------|-----------|------|
| 文件系统 | 隔离 | 独立的容器文件系统 |
| 网络 | ❌ 默认禁用 | 无法访问外网 |
| 进程 | 隔离 | 无法看到主机进程 |
| 用户 | 非特权 | 以 uid=1000 运行 |
| 系统调用 | 受限 | Docker 默认安全策略 |

---

## 四、数据流向图

### 4.1 正常操作流程

```
用户消息
    │
    ▼
┌─────────────────┐
│ OpenClaw Gateway│  ← 运行在 Ubuntu 主机
│  (解析意图)      │
└────────┬────────┘
         │
    ┌────┴────┐
    │ 工具调用 │
    └────┬────┘
         │
    ┌────┴────────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌──────────────┐                        ┌──────────────┐
│ read/write/  │                        │    exec      │
│    edit      │                        │  (命令执行)   │
└──────┬───────┘                        └──────┬───────┘
       │                                       │
       ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│ workspaceOnly    │                  │ Docker Sandbox   │
│ 策略检查         │                  │ 隔离执行         │
└────────┬─────────┘                  └────────┬─────────┘
         │                                     │
         ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│ ~/.openclaw/     │                  │ 容器内 /workspace │
│ workspace/       │                  │ 独立环境         │
└──────────────────┘                  └──────────────────┘
```

### 4.2 被阻止的操作

```
用户消息 (恶意/误操作)
    │
    ▼
┌─────────────────┐
│ OpenClaw Gateway│
└────────┬────────┘
         │
    ┌────┴────┐
    │ 工具调用 │
    └────┬────┘
         │
    ┌────┴────────────────────────────────────────┐
    │                                             │
    ▼                                             ▼
┌──────────────┐                        ┌──────────────┐
│ read("/etc/")│                        │ exec("rm -rf")│
│ (尝试读系统)  │                        │ (危险命令)    │
└──────┬───────┘                        └──────┬───────┘
       │                                       │
       ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│ ❌ workspaceOnly │                  │ Docker 隔离      │
│   策略拒绝       │                  │ 仅影响容器       │
│ Path escapes    │                  │ 主机不受影响     │
│ sandbox root    │                  │                  │
└──────────────────┘                  └──────────────────┘
```

---

## 五、对 Agent 能力的影响

### 5.1 受影响的功能

| 功能 | 影响程度 | 原因 | 解决方案 |
|------|---------|------|---------|
| **命令执行** | ⚠️ 受限 | 在沙箱内执行，无网络工具 | 配置 `sandbox.docker.network` 开启网络 |
| **Web Search** | ⚠️ 不可用 | 沙箱无网络访问 | 配置沙箱网络或使用主机执行 |
| **Web Fetch** | ⚠️ 不可用 | 沙箱无 curl/wget | 同上 |
| **文件操作** | ✅ 正常 | 限制在 workspace 内 | 无需处理 |
| **代码执行** | ✅ 正常 | Python3 已预装 | 无需处理 |

### 5.2 不受影响的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| **飞书通讯** | ✅ 正常 | Gateway 在主机运行，不在沙箱内 |
| **消息收发** | ✅ 正常 | 同上 |
| **会话管理** | ✅ 正常 | 同上 |
| **记忆/上下文** | ✅ 正常 | workspace 可正常读写 |
| **模型调用** | ✅ 正常 | API 调用由 Gateway 处理 |
| **Skills 执行** | ⚠️ 部分受限 | 涉及网络的 skills 需要配置 |

### 5.3 网络相关功能说明

**重要：** 沙箱隔离的是 `exec` 工具（命令执行），不是 Gateway 本身。

```
┌─────────────────────────────────────────────────────────────┐
│                     Ubuntu 主机                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              OpenClaw Gateway                        │   │
│  │                                                      │   │
│  │   • 飞书 API 调用 ←── ✅ 正常（主机网络）              │   │
│  │   • 模型 API 调用 ←── ✅ 正常                         │   │
│  │   • Web Search API ←── ✅ 正常（如果配置）            │   │
│  │                                                      │   │
│  │   ┌──────────────────────────────────────────────┐  │   │
│  │   │         Docker Sandbox                        │  │   │
│  │   │                                              │  │   │
│  │   │   • exec 命令 ←── ❌ 无网络（默认）            │  │   │
│  │   │   • curl/wget ←── ❌ 无此工具（需自定义镜像）   │  │   │
│  │   │   • apt-get  ←── ❌ 无网络                     │  │   │
│  │   │                                              │  │   │
│  │   └──────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**结论：**
- 飞书通讯、模型调用等由 Gateway 直接处理的网络请求**不受影响**
- 只有通过 `exec` 工具在沙箱内执行的命令才受网络限制

---

## 六、配置步骤回顾

### 步骤 1：文件系统限制

```bash
openclaw config set tools.fs.workspaceOnly true
```

### 步骤 2：安装 Docker（WSL2）

```bash
sudo apt update
sudo apt install docker.io -y
sudo usermod -aG docker $USER
```

### 步骤 3：配置 Docker 镜像加速（国内）

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo service docker restart
```

### 步骤 4：构建沙箱镜像

```bash
mkdir -p ~/openclaw-sandbox-build && cd ~/openclaw-sandbox-build

cat > Dockerfile.sandbox << 'EOF'
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    python3 \
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash sandbox
USER sandbox
WORKDIR /home/sandbox

CMD ["sleep", "infinity"]
EOF

docker build -t openclaw-sandbox:bookworm-slim -f Dockerfile.sandbox .
```

### 步骤 5：启用沙箱模式

```bash
openclaw config set agents.defaults.sandbox.mode all
```

### 步骤 6：验证配置

```bash
openclaw doctor
openclaw security audit
```

---

## 七、可选增强配置

### 7.1 为沙箱开启网络（如需 Web Search）

```bash
openclaw config set agents.defaults.sandbox.docker.network bridge
```

### 7.2 配置审批模式（额外安全层）

```bash
openclaw config set tools.exec.security ask
openclaw config set tools.exec.ask always
```

### 7.3 自定义沙箱镜像（添加更多工具）

修改 Dockerfile.sandbox，添加所需工具后重新构建。

---

## 八、安全审计清单

定期执行以下命令检查安全状态：

```bash
# 全面安全审计
openclaw security audit --deep

# 检查沙箱镜像
docker images | grep openclaw-sandbox

# 检查配置
openclaw config get tools.fs.workspaceOnly
openclaw config get agents.defaults.sandbox.mode

# 健康检查
openclaw doctor
```

---

## 九、故障排查

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 命令执行失败 | 沙箱镜像未构建 | 运行 `docker build` 构建镜像 |
| 文件读写被拒绝 | workspaceOnly 限制 | 确认文件在 workspace 目录内 |
| 网络命令失败 | 沙箱无网络 | 配置 `sandbox.docker.network` |
| Docker 服务未运行 | WSL 未自动启动 | `sudo service docker start` |

---

## 十、总结

通过 **文件系统限制** + **Docker 沙箱** 的组合：

1. **文件层面**：Agent 只能操作 workspace 目录，无法访问系统文件、配置、密钥、Windows 分区
2. **执行层面**：所有命令在隔离容器中运行，即使执行恶意命令也只影响容器
3. **网络层面**：默认无网络，防止数据外泄（可按需开启）
4. **功能层面**：核心功能（飞书、模型调用）不受影响，仅 exec 内的网络操作受限

这种配置适合个人助手场景，在安全性和可用性之间取得了良好平衡。

---

*本文档由 Damon 整理，Nemo 人机知识化*