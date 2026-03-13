# 飞书机器人应用与 OpenClaw 连接配置指南

> **来源**：Damon 与 Nemo 的实际配置排查经验  
> **日期**：2026-03-13  
> **版本**：1.0

---

## 概述

本文档总结飞书机器人应用、群组相关 ID 的关系，以及在 OpenClaw 中如何正确配置这些 ID。基于实际排查经验整理，帮助快速定位和解决飞书集成问题。

---

## 一、飞书 ID 类型详解

### 1.1 用户相关 ID

| ID 类型 | 格式示例 | 特点 | 用途 |
|---------|----------|------|------|
| **open_id** | `ou_17e04587a732ee042cf341f753f013c9` | **每个应用不同** | 应用内用户标识，API 调用常用 |
| **user_id** | `xxx` | 企业内唯一 | 企业内部系统标识 |
| **union_id** | `on_xxx` | 同一企业下应用共享 | 跨应用用户关联 |

### 1.2 应用相关 ID

| ID 类型 | 格式示例 | 说明 |
|---------|----------|------|
| **app_id** | `cli_a9246fa953b89bca` | 飞书应用的唯一标识，创建时生成 |
| **app_secret** | `Lm7WIET31kvfo0fA1IL6Ke0F28MynFoz` | 应用密钥，用于获取 access_token |

### 1.3 群组相关 ID

| ID 类型 | 格式示例 | 说明 |
|---------|----------|------|
| **chat_id / open_chat_id** | `oc_f3ffc0e3dec616de9c46d25f891f0c26` | 群组唯一标识，`oc_` 开头 |

---

## 二、关键发现：同一用户的 open_id 在不同应用下不同

**这是最容易踩坑的地方！**

飞书出于隐私保护设计，**同一用户在不同飞书应用下的 open_id 是完全不同的**。

### 实际案例

Damon 在两个飞书机器人应用中的 open_id：

| 应用 | App ID | Damon 的 open_id |
|------|--------|------------------|
| 飞书机器人1 | `cli_a9155c3fcdf8dbcc` | `ou_17e04587a732ee042cf341f753f013c9` |
| 飞书机器人2 | `cli_a9246fa953b89bca` | `ou_6141bb00adbde680be5b2d00eca4fb41` |

**这意味着：** 配置 `allowFrom` 时，必须使用对应当前应用的 open_id，不能直接复用其他应用的 open_id。

### 如何获取正确的 open_id

1. **飞书开放平台 → 应用详情 → 调试工具**
   - 发送消息后查看日志，可以看到发送者的 open_id

2. **查看 API 调用日志**
   - 平台日志中会显示完整的请求信息，包含 open_id

3. **OpenClaw 日志**
   - Gateway 日志中会记录收到的消息来源

---

## 三、OpenClaw 配置详解

### 3.1 配置结构

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "defaultAccount": "app1",
      "accounts": {
        "app1": {
          "enabled": true,
          "name": "飞书机器人1",
          "appId": "cli_a9155c3fcdf8dbcc",
          "appSecret": "your_app_secret",
          "dmPolicy": "allowlist",
          "groupPolicy": "allowlist",
          "allowFrom": ["ou_xxx"],           // 私聊白名单
          "groupAllowFrom": ["ou_xxx", "oc_xxx"]  // 群聊白名单
        },
        "app2": {
          "enabled": true,
          "name": "飞书机器人2",
          "appId": "cli_a9246fa953b89bca",
          "appSecret": "your_app_secret",
          "dmPolicy": "allowlist",
          "groupPolicy": "allowlist",
          "allowFrom": ["ou_yyy"],           // 注意：这个 open_id 与 app1 不同！
          "groupAllowFrom": ["oc_xxx"]
        }
      }
    }
  }
}
```

### 3.2 关键配置字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `dmPolicy` | string | 私聊策略：`allowlist`(白名单) / `denylist`(黑名单) / `all`(允许所有) |
| `groupPolicy` | string | 群聊策略，同上 |
| `allowFrom` | array | 私聊白名单，填用户 open_id (`ou_` 开头) |
| `groupAllowFrom` | array | 群聊白名单，填群组 ID (`oc_` 开头) 或用户 open_id |

### 3.3 常见配置错误

| 错误 | 正确做法 |
|------|----------|
| `groupAllowFrom` 填了用户 ID | 应填群组 ID (`oc_xxx`) |
| 复用了其他应用的 open_id | 每个应用需单独获取对应用户的 open_id |
| 只配置了一个应用的白名单 | 每个应用账户需独立配置白名单 |

---

## 四、飞书开放平台权限配置

### 4.1 必需权限

OpenClaw 需要以下权限才能正常工作：

| 权限 | 用途 |
|------|------|
| `contact:contact.base:readonly` | 获取用户信息（私聊必需） |
| `im:message` | 接收和发送消息 |
| `im:message:send_as_bot` | 以机器人身份发送消息 |

### 4.2 权限配置步骤

1. 飞书开放平台 → 应用详情 → 权限管理
2. 搜索所需权限并申请
3. 等待管理员审批（企业版）
4. 发布新版本应用

### 4.3 权限不足的表现

API 调用返回 400 错误：

```json
{
  "httpCode": 400,
  "errCode": 99991672,
  "errMsg": "Access denied. One of the following scopes is required: [contact:contact.base:readonly, ...]"
}
```

---

## 五、故障排查清单

### 5.1 私聊不回复

| 排查项 | 检查方法 |
|--------|----------|
| ✅ 应用已启用 | OpenClaw 配置 `enabled: true` |
| ✅ open_id 在白名单 | 检查 `allowFrom` 是否包含当前应用下的 open_id |
| ✅ 通讯录权限 | 飞书开放平台检查 `contact:contact.base:readonly` |
| ✅ 事件订阅 URL | 飞书开放平台检查事件订阅是否验证通过 |

### 5.2 群聊不回复

| 排查项 | 检查方法 |
|--------|----------|
| ✅ 群 ID 在白名单 | 检查 `groupAllowFrom` 是否包含群组 ID (`oc_xxx`) |
| ✅ 机器人已加入群 | 确认机器人已邀请进群 |
| ✅ 消息是否 @机器人 | 部分配置需要 @ 才触发 |

### 5.3 多应用场景

| 排查项 | 检查方法 |
|--------|----------|
| ✅ 每个应用独立配置 | 每个账户的 `allowFrom` 需单独配置 |
| ✅ open_id 不共用 | 不同应用下同一用户的 open_id 不同 |

---

## 六、获取 ID 的实用方法

### 6.1 获取用户 open_id

```bash
# 方法1：查看 OpenClaw 状态
openclaw status

# 方法2：查看飞书平台日志
# 开放平台 → 应用详情 → 日志 → 找到消息记录
```

### 6.2 获取群组 ID

```bash
# 方法1：从 OpenClaw session 名称提取
# session key 格式：agent:main:feishu:group:oc_xxx

# 方法2：飞书开放平台调试工具
# 在群组发送消息，查看 chat_id
```

---

## 七、配置更新流程

1. 修改配置文件 `~/.openclaw/openclaw.json`
2. 重启 Gateway：`openclaw gateway restart` 或调用 `gateway` tool
3. 验证配置：`openclaw status`

---

## 一句话总结

**同一用户在不同飞书应用下的 open_id 不同，配置白名单时必须使用对应当前应用的用户 open_id，群聊白名单填群组 ID (`oc_` 开头)。**

---

## 相关资源

- [飞书开放平台](https://open.feishu.cn)
- [OpenClaw 文档](https://docs.openclaw.ai)
- [飞书权限说明](https://open.feishu.cn/document/ukTMukTMukTMuYzY5Mjg2MjM4MjcyNjE4MjE5MjI5)