<div align="center">

# FitTrack-AI

### AI 驱动的个人健康管理全栈项目

基于 `React + Express + SQLite` 构建，围绕「记录 -> 理解 -> 分析 -> 调整」闭环，整合饮食、运动、身体指标、禁食、自律打卡与多模态 AI 分析。

[中文](./README.md) | [English](./README_EN.md)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![AI](https://img.shields.io/badge/AI-Multimodal%20Pipeline-7B61FF)
![Status](https://img.shields.io/badge/Project-Portfolio%20Ready-2EA44F)

</div>

---

> 一个更适合求职展示而不是纯 Demo 的 AI 应用项目：支持图片识别、语音转写、结构化日志抽取、日/周健康分析，并显式处理双引擎 AI 编排、缺失单位恢复、混合语音日志落库、自律连续打卡规则建模等工程问题。

**快速导航**

[快速开始](#快速开始) · [核心能力](#核心能力) · [架构亮点](#架构亮点) · [截图预览](#截图预览)

## 为什么值得看

- 不是单点功能演示，而是完整的 `React + Express + SQLite` 全栈应用。
- AI 能力被放进真实业务流，而不是只返回一段模型文本。
- 项目覆盖图片识别、语音转写、结构化抽取、日志落库、健康分析的完整链路。
- 对模型输出不稳定、单位缺失、历史归档、连续打卡等问题做了明确工程处理。
- 适合作为数据分析、算法工程、大模型应用开发方向的项目背书。

## 核心能力

- 饮食与运动记录：支持手动记录、食物专属单位换算、拍照识别预填充。
- AI 健康分析：输出 `health_score`、`alert_level`、`analysis_report`，支持日报与周报。
- 身体指标与禁食：支持体重/围度/照片记录、身体对比、禁食状态追踪。
- 自律打卡：支持今日任务、热力图、30 天趋势、当前连续天数与历史最佳连续天数。
- 语音优先记录：支持服务端 STT、中文自然语言混合提取、确认后批量写入。

## 架构亮点

### 1. 双引擎 AI 链路

- 视觉模型负责图像理解、食物识别和描述生成。
- 推理模型负责结构化 JSON、营养估算、健康评分与分析报告。
- 使用“两阶段链路”代替一步输出复杂结构，降低格式漂移风险。

### 2. 语音日志可安全落库

- 服务端将 `STT -> 结构化提取 -> 人工确认 -> 批量写入` 拆成独立阶段。
- 当食物缺少专属单位时，系统会尝试让 AI 补估 `grams_per_unit` 与 `calories_per_unit` 后重试提交。
- 若恢复失败，则优雅降级，而不是整批报错失败。

### 3. 业务规则被显式建模

- 自律模块使用独立路由 `#/discipline`，避免刷新丢状态。
- `current_streak` 采用容错计算规则，`max_streak` 在归档后仍保留。
- 归档习惯不会出现在当前任务中，但仍参与历史统计。

### 4. 数据边界清晰

- `food_units` 绑定具体 `food_id`，避免单位换算错误。
- `habit_logs` 使用 `UNIQUE(habit_id, date)` 约束单日唯一状态。
- SQLite 运行在 `WAL` 模式下，更适合 Windows 本地开发环境。

## 截图预览

| 模块 | 预览 |
| --- | --- |
| Dashboard | [dashboard.png](./docs/screenshots/dashboard.png) |
| 日志页 | [logs.png](./docs/screenshots/logs.png) |
| AI 日报 | [analytics-daily.png](./docs/screenshots/analytics-daily.png) |
| AI 周报 | [analytics-weekly.png](./docs/screenshots/analytics-weekly.png) |
| 身体指标 | [body-metrics.png](./docs/screenshots/body-metrics.png) |
| 自律模块 | [discipline.png](./docs/screenshots/discipline.png) |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填写模型提供方配置：

```env
PORT=3000
NODE_ENV=development

GEMINI_API_KEY=
GEMINI_BASE_URL=

ZHIPU_API_KEY=
ZHIPU_BASE_URL=
ZHIPU_TEXT_MODEL=
ZHIPU_VISION_MODEL=

TONGYI_API_KEY=
TONGYI_BASE_URL=
TONGYI_TEXT_MODEL=
TONGYI_VISION_MODEL=

SILRA_API_KEY=
SILRA_BASE_URL=
SILRA_TEXT_MODEL=
SILRA_VISION_MODEL=
VOICE_ASR_PROVIDER=
VOICE_ASR_MODELS=
```

### 3. 启动项目

```bash
npm run dev
```

默认情况下：

- 前端由 Vite 提供开发服务
- 后端由 Express 提供 API
- SQLite 数据库位于 `db/fittrack.db`

## 技术栈

- 前端：`React 19`、`Vite`、`TypeScript`、`Recharts`、`Motion`
- 后端：`Express`、`better-sqlite3`、`Node.js`
- AI：视觉模型、文本推理模型、服务端 STT、结构化提取与回退策略

## 项目结构

```text
FitTrack-AI
├─ src/
│  ├─ components/        # 通用 UI 组件
│  ├─ pages/             # 页面级视图
│  └─ server/            # 服务层、数据库、AI 编排
├─ docs/screenshots/     # 项目截图
├─ db/                   # SQLite 数据库文件
├─ public/               # 静态资源
└─ server.ts             # Express 入口
```

关键文件：

- `server.ts`：后端入口，负责 API、静态资源、AI 编排和健康检查。
- `src/server/db.ts`：SQLite 建表与数据访问逻辑。
- `src/server/aiService.ts`：模型调用、Prompt 组织、结构化解析和回退。
- `src/server/voiceService.ts`：中文语音文本抽取与规则解析。
- `src/server/voiceTranscriptionService.ts`：服务端 STT 提供方与模型回退编排。
- `src/App.tsx`：前端主入口与页面流程编排。

## 主要接口

- AI 与分析：`POST /api/ai/generate`、`GET /api/health`、`GET /api/analytics/daily`、`GET /api/analytics/weekly`
- 语音记录：`POST /api/voice/transcribe`、`POST /api/voice/extract`、`POST /api/voice/commit`
- 饮食与日志：`GET /api/foods/search`、`POST /api/foods`、`GET /api/logs/:date`、`POST /api/logs/:type`
- 自律：`GET /api/habits`、`GET /api/habits/today`、`POST /api/habits/:id/check-in`、`GET /api/habits/heatmap`

## 验证方式

```bash
npm run lint
```

当前 `lint` 实际执行：

```bash
tsc --noEmit
```

建议回归检查：

- 调用 `GET /api/health` 检查模型与服务可用性。
- 上传食物图片，检查识别、结构化营养输出和分析卡片渲染。
- 执行一次语音记录，检查转写、抽取、确认、提交链路。
- 在自律页完成一次打卡，检查 `current_streak`、热力图和趋势图更新。

## Roadmap

- [ ] 增加更完整的模型提供方切换与观测日志
- [ ] 将当前 hash 路由逐步迁移到更完整的路由体系
- [ ] 增加更系统的自动化测试
- [ ] 增加更细粒度的健康趋势解释和异常提示
- [ ] 支持更强的用户画像与个性化建议

## License

当前仓库未包含明确的开源许可证文件。如果准备长期公开维护，建议补充 `LICENSE`。
