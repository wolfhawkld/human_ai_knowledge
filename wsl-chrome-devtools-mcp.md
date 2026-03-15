# WSL + Chrome DevTools MCP 自动化配置指南

> 测试日期：2026-03-15  
> 测试环境：WSL2 on Windows, OpenClaw 2026.3.13, Claude Code

## 背景

在 WSL 环境中使用 AI Agent（如 Claude Code）操作 Windows 上的 Chrome 浏览器进行自动化任务（如 12306 订票），需要解决 WSL 与 Windows 之间的网络隔离问题。

## 问题

1. **WSL2 默认使用 NAT 网络模式**，WSL 和 Windows 有不同的 IP 地址
2. **Chrome DevTools MCP 无法直接连接 Windows Chrome**，因为 localhost 不互通
3. **代理配置复杂**，WSL 无法自动使用 Windows 的 Clash 等代理

## 解决方案：WSL Mirrored 模式

### 开启方法

在 Windows 用户目录下创建或编辑 `%USERPROFILE%\.wslconfig`：

```ini
[wsl2]
networkingMode=mirrored
```

然后重启 WSL：

```powershell
wsl --shutdown
```

### Mirrored vs NAT 对比

| 特性 | NAT 模式（默认） | Mirrored 模式 |
|------|-----------------|---------------|
| IP 地址 | WSL 有独立虚拟 IP | WSL 直接使用 Windows IP |
| localhost 互通 | ❌ 需要端口转发 | ✅ 直接互通 |
| 代理继承 | ❌ 需手动配置 | ✅ 自动继承 Windows 代理 |
| Chrome 调试端口 | ❌ 无法直接访问 | ✅ 可以直接访问 |
| 局域网访问 | ✅ 正常 | ⚠️ 可能有变化 |

### Claude Code 配置

在 Mirrored 模式下，使用 `chrome-devtools-mcp-bridge` 连接 Windows Chrome：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp-bridge@latest", "--browser-url=http://127.0.0.1:9222"]
    }
  }
}
```

### Windows Chrome 启动（带调试端口）

```powershell
# PowerShell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%TEMP%\chrome-debug
```

或手动在 Chrome 地址栏访问 `chrome://inspect/#remote-debugging` 启用远程调试。

## 注意事项

### Mirrored 模式的影响

1. **网络变化** — 开启后可能影响局域网设备访问（如其他 AI 实例 Nemo）
2. **代理自动继承** — Windows 的 Clash/Clash Verge 代理会自动生效
3. **防火墙** — 可能需要调整 Windows 防火墙规则

### 推荐使用场景

- **需要时开启 Mirrored** — 进行浏览器自动化任务
- **完成后切回 NAT** — 恢复正常的局域网访问和 OpenClaw 连接

### 切换回 NAT 模式

编辑 `.wslconfig`，注释或删除 `networkingMode`：

```ini
[wsl2]
# networkingMode=mirrored
```

然后 `wsl --shutdown` 重启。

## 测试结果

| 测试项 | NAT 模式 | Mirrored 模式 |
|--------|---------|---------------|
| 访问 OpenClaw Gateway | ✅ 正常 | ❌ 可能受影响 |
| WSL Claude Code → Windows Chrome | ❌ 无法连接 | ✅ 正常 |
| 代理访问 Google/YouTube | ❌ 需手动配置 | ✅ 自动继承 |
| 局域网设备（如 Nemo） | ✅ 可达 | ⚠️ 需重新测试 |

## 总结

- Mirrored 模式解决了 WSL 与 Windows 的网络隔离问题，适合浏览器自动化场景
- NAT 模式保持网络独立性，适合日常 OpenClaw 使用
- 根据实际需求灵活切换两种模式

## 相关链接

- Chrome DevTools MCP: https://github.com/ChromeDevTools/chrome-devtools-mcp
- WSL 网络配置: https://learn.microsoft.com/zh-cn/windows/wsl/networking
- OpenClaw Browser 文档: https://docs.openclaw.ai/tools/browser