# 聊天练习 App

一个本地运行的中文聊天训练工具，帮助你练习与女性朋友自然建立关系的能力。

通过与 AI 角色模拟微信聊天，获得三导师（童锦程 · Gottman · Ariadne）的专业复盘反馈，逐步提升聊天水平。

## 核心功能

- **角色扮演聊天** — 与 AI 驱动的角色进行微信风格的自由对话
- **情感账户系统** — 模拟真实关系的亲密度变化，关系可以升温也可以破裂
- **三导师复盘** — 每次聊天结束后，三位导师从不同维度给出逐条点评
  - 童锦程：实战派话术点评，告诉你哪句话说得好/不好、怎么改
  - Gottman：心理学底层分析，解释为什么这么说有效
  - Ariadne：结构化评分，量化关系维度变化
- **长期记忆** — 角色会记住你之前聊过的内容，跨会话保持一致性
- **角色分身** — 重置情感账户分数，从头开始练习同一个角色

## 快速开始

### 1. 克隆项目

`ash
git clone https://github.com/你的用户名/chat-practice-app.git
cd chat-practice-app
`

### 2. 安装依赖

`ash
npm install
`

### 3. 配置 API Key

复制环境变量模板：

`ash
cp .env.example .env
`

编辑 .env，填入你的 API Key：

`
MIMO_API_KEY=你的API密钥
`

> **如何获取 API Key：**
> 前往 [小米 MiMo 开放平台](https://open.xiaomimimo.com) 注册账号并创建 API Key。
> 新用户通常有免费额度，足够体验完整功能。

### 4. 启动项目

`ash
npm run dev:all
`

启动后会同时运行：
- 后端 API：http://localhost:8787
- 前端页面：http://localhost:5173

浏览器会自动打开，选择角色即可开始聊天。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 后端 | Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| AI | 小米 MiMo API (OpenAI 兼容格式) |

## 项目结构

`
src/
├── client/          # 前端 React 应用
│   ├── components/  # UI 组件
│   ├── pages/       # 页面组件
│   └── store/       # Zustand 状态管理
├── server/          # 后端 Express 服务
│   ├── ai/          # AI 提示词与调用
│   ├── services/    # 数据服务层
│   └── data.ts      # 角色与导师数据
└── shared/          # 前后端共享类型
skills/              # AI 技能文件（导师人设与分析框架）
`

## 内置角色

| 角色 | 来源 | 特点 |
|---|---|---|
| 梁友安 | 《爱情而已》 | 27岁体育经纪人，独立、专业、有边界感 |

## 内置导师

| 导师 | 类型 | 擅长领域 |
|---|---|---|
| 童锦程 | 实战派 | 话术点评、聊天技巧、信号识别 |
| John Gottman | 心理学 | 关系动力学、情感账户、依恋模式 |
| Ariadne | 评分系统 | 结构化维度评分、关系趋势分析 |

## 常用命令

`ash
npm run dev:all    # 同时启动前端和后端
npm run dev        # 仅启动前端
npm run server     # 仅启动后端
npm run test       # 运行测试
npm run build      # 构建生产版本
npm run typecheck  # 类型检查
`

## 数据存储

所有数据存储在本地 data/ 目录下：
- chat.db — SQLite 数据库（角色、会话、消息、复盘报告）
- 该目录已在 .gitignore 中排除，不会被提交到 Git

## 免责声明

本项目是一个**健康关系训练工具**，旨在帮助用户提升自然社交和表达能力。

- 本项目不教授 PUA、操控、施压、骚扰或任何不尊重他人的技巧
- AI 角色的回复不代表真实人物的观点或行为
- 用户应将练习中学到的技能用于建立真诚、平等、互相尊重的关系
