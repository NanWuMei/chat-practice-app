# 镜子 — 新电脑部署指南

## 环境要求

- Node.js >= 18（推荐 20 LTS 或更高）
- Git

> **⚠️ Windows 用户注意：** 项目路径不能包含中文或特殊字符。
> 例如 `C:\Users\小明\桌面\chat-practice-app` 会报错，请放在纯英文路径下如 `C:\Projects\chat-practice-app`。

## 快速开始（3 步）

### 1. 克隆项目

```bash
git clone https://github.com/NanWuMei/chat-practice-app.git
cd chat-practice-app
```

> 如果不用 git，直接下载 zip 解压也可以，但同样要放在纯英文路径下。

### 2. 配置 AI API

项目使用 OpenAI 兼容格式（`/chat/completions`），支持任意兼容服务商。

**在项目根目录找到 `.env` 文件，编辑以下三个值：**

```env
MIMO_API_KEY=你的API密钥
MIMO_API_BASE=你的API地址
MIMO_MODEL=你的模型名
```

> 如果项目中没有 `.env` 文件，先复制一份：`cp .env.example .env`（Windows 用 `copy .env.example .env`）。
> `npm start` 也会在首次运行时自动帮你创建。

**各服务商配置示例：**

| 服务商 | MIMO_API_BASE | MIMO_MODEL |
|--------|---------------|------------|
| 小米 MiMo（默认） | `https://token-plan-cn.xiaomimimo.com/v1` | `MiMo-v2.5-pro` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |

> **小米 MiMo API Key 获取：** 前往 [小米 MiMo 开放平台](https://open.xiaomimimo.com) 注册，创建 API Key。

### 3. 一键启动

```bash
npm start
```

`npm start` 会自动完成：
- 安装依赖（如 `node_modules` 不存在）
- 创建 SQLite 数据库（自动）
- 同时启动前端 + 后端
- 自动打开浏览器

启动后浏览器会自动打开 http://localhost:5173，选择角色即可开始聊天。

## 启动后验证

| 服务 | 地址 | 预期结果 |
|------|------|----------|
| 前端 | http://localhost:5173 | 看到角色选择页 |
| 后端 | http://localhost:8787/api/health | 返回 `{"status":"ok"}` |

## 常见问题

**端口被占用**
修改 `.env` 中的 `PORT` 值（如 `PORT=9000`），前端会自动代理到后端。

**API 报错**
- 检查 `.env` 中 `MIMO_API_KEY` 是否填写完整，无多余空格
- 确认 `MIMO_API_BASE` 地址正确（以 `/v1` 结尾）
- 确认 `MIMO_MODEL` 名称与服务商文档一致

**Node.js 版本过低**
运行 `node -v` 确认版本 >= 18。如版本过低，前往 https://nodejs.org 下载最新 LTS。

**路径包含中文导致报错**
把项目移到纯英文路径下（如 `C:\Projects\chat-practice-app`），重新启动即可。

## 可选：生产构建

```bash
npm run build      # 构建前端到 dist/
npm run preview    # 预览构建结果
```

构建后前端产物在 `dist/` 目录，可部署到任意静态托管服务。后端仍需单独运行 `npm run server`。
