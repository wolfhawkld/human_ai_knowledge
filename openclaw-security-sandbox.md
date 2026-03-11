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

## 二、安全配置方案：双层防护架构

采用 **文件系统限制 + Docker 沙箱** 的双层防护：

### 2.1 文件系统限制

**配置项：** `tools.fs.workspaceOnly: true`

**生效范围：** `read`、`write`、`edit` 文件操作工具

| 路径 | 访问权限 | 说明 |
|------|---------|------|
| `~/.openclaw/workspace/` | ✅ 可读写 | Agent 唯一可操作的文件区域 |
| `~/.openclaw/openclaw.json` | ❌ 禁止访问 | 配置文件（含密钥） |
| `~/.openclaw/credentials/` | ❌ 禁止访问 | 认证凭据存储 |
| `/mnt/c/` (Windows) | ❌ 禁止访问 | Windows 文件系统 |
| `/etc/`, `/var/`, `/root/` | ❌ 禁止访问 | 系统目录 |

### 2.2 Docker 沙箱隔离

**配置项：** `agents.defaults.sandbox.mode: "all"`

**生效范围：** `exec` 命令执行工具

| 资源 | 沙箱内状态 |
|------|-----------|
| 文件系统 | 隔离（独立容器文件系统） |
| 网络 | ❌ 默认禁用 |
| 进程 | 隔离（无法看到主机进程） |
| 用户 | 非特权（uid=1000） |

---

## 三、核心配置命令

```bash
# 文件系统限制
openclaw config set tools.fs.workspaceOnly true

# 启用沙箱模式
openclaw config set agents.defaults.sandbox.mode all

# 构建沙箱镜像
docker build -t openclaw-sandbox:bookworm-slim -f Dockerfile.sandbox .

# 验证配置
openclaw doctor
openclaw security audit
```

---

## 四、对 Agent 能力的影响

### 4.1 受影响的功能

| 功能 | 影响程度 | 解决方案 |
|------|---------|---------|
| 命令执行 | ⚠️ 受限 | 配置 `sandbox.docker.network` 开启网络 |
| Web Search | ⚠️ 沙箱内不可用 | 使用主机执行或开启沙箱网络 |
| Web Fetch | ⚠️ 沙箱内不可用 | 同上 |

### 4.2 不受影响的功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 飞书通讯 | ✅ 正常 | Gateway 在主机运行 |
| 模型调用 | ✅ 正常 | API 调用由 Gateway 处理 |
| 会话管理 | ✅ 正常 | 同上 |
| 记忆/上下文 | ✅ 正常 | workspace 可正常读写 |

**关键理解：** 沙箱隔离的是 `exec` 工具，不是 Gateway 本身。Gateway 直接处理的网络请求不受影响。

---

## 五、安全审计清单

```bash
# 全面安全审计
openclaw security audit --deep

# 检查沙箱镜像
docker images | grep openclaw-sandbox

# 检查配置
openclaw config get tools.fs.workspaceOnly
openclaw config get agents.defaults.sandbox.mode
```

---

## 六、总结

通过 **文件系统限制 + Docker 沙箱** 的组合：

1. **文件层面**：Agent 只能操作 workspace 目录
2. **执行层面**：所有命令在隔离容器中运行
3. **网络层面**：默认无网络，防止数据外泄
4. **功能层面**：核心功能不受影响

这种配置适合个人助手场景，在安全性和可用性之间取得了良好平衡。

---

*本文档由 Damon 整理，Nemo 人机知识化*