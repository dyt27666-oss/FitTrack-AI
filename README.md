# FitTrack-AI

[English](./README_EN.md)

FitTrack-AI 是一个面向个人健康管理场景的 AI 驱动全栈项目，围绕“记录 -> 理解 -> 分析 -> 调整”的闭环设计，整合了饮食记录、运动记录、身体指标、间歇性禁食、自律打卡，以及双引擎 AI 分析能力。

这是一个偏“求职作品集”的项目型仓库：不是单纯的 UI 展示，也不是只调用一次模型接口的 Demo，而是一个可运行的 AI 健康管理原型，重点展示多模态识别、结构化输出、语音日志解析、健康分析链路和本地持久化能力。

## 简历版描述

> 基于 `React + Express + SQLite` 实现的 AI 健康管理全栈项目，集成图片识别、语音转写、结构化日志抽取、日/周健康分析等能力；重点解决了双引擎 AI 编排、语音混合日志落库、缺失单位自动恢复、自律连续打卡规则建模等工程问题。

## 一眼看懂

- 项目类型：`React + Express + SQLite` 全栈 AI 应用
- 核心场景：饮食、运动、身体指标、禁食、自律打卡、AI 健康分析
- AI 能力：图片识别、语音转写、结构化抽取、日/周分析
- 工程重点：双引擎 AI 编排、语音混合日志落库、单位缺失恢复、连续打卡规则建模
- 展示价值：适合用于数据分析、算法工程、大模型应用开发方向的项目背书

## 为什么这个项目值得看

如果你是面试官、招聘方，或者正在评估这个项目的工程含金量，可以优先关注下面几个点：

1. 这是一个完整的 `React + Express + SQLite` 全栈项目，而不是单点功能演示。
2. 项目把 AI 能力嵌入到了真实业务流里，而不是停留在“调用一次模型返回一段文本”的层面。
3. 它包含一条比较完整的多模态数据链路：图片识别、语音转写、结构化抽取、日志落库、日/周分析。
4. 项目显式处理了模型输出不稳定、单位缺失、路由状态保持、历史数据归档、连续打卡统计等工程细节。
5. 对于想投递数据分析、算法工程、大模型应用开发相关岗位的人，这个仓库能同时展示产品意识、工程实现能力和 AI 集成能力。

## 核心亮点

### 1. 双引擎 AI 架构

- 视觉模型负责图像理解、食物识别和描述生成。
- 推理模型负责结构化 JSON、营养估算、健康评分和分析报告生成。
- 采用“两阶段链路”而不是直接让多模态模型一步输出复杂 JSON，以降低失败率并提高可控性。

为什么这是必要的？因为多模态模型在“既要看图，又要严格返回复杂结构”时通常更容易出现格式漂移。先描述、再推理，是一个更稳健的工程折中。

### 2. 面向真实使用场景的语音记录链路

- 用户可以用一段自然语言同时描述饮食和运动。
- 服务端先做 STT，再做结构化提取，再进入人工确认，最后批量写入。
- 当食物缺少专属单位时，系统会尝试让 AI 估算 `grams_per_unit` 和 `calories_per_unit`，写入成功后自动重试提交。
- 如果单位补全仍失败，系统会降级为普通食物记录，而不是整批报错失败。

这背后反映的问题是什么？不是“能不能识别语音”，而是“语音识别之后，如何把模糊自然语言安全地接进已有数据模型”。

### 3. 自律打卡模块不是简单的 UI 功能

- 自律页被拆成独立路由 `#/discipline`，而不是仅靠 tab 状态切换。
- 打卡连续天数 `current_streak` 的计算规则做了容错设计：
  - 今天完成，则从今天向前回溯；
  - 今天未完成但昨天完成，则从昨天向前回溯；
  - 否则记为 `0`。
- 历史最佳连续天数 `max_streak` 在归档后依旧保留，历史努力不会因为任务下线而丢失。

这类细节为什么重要？因为它体现的不是页面开发，而是“业务规则是否被认真建模”。

### 4. 数据边界和持久化设计更接近真实产品

- `food_units` 绑定具体 `food_id`，避免“单位通用化”导致的换算错误。
- `habit_logs` 使用 `UNIQUE(habit_id, date)` 约束单日唯一状态。
- 归档习惯不会出现在今日任务中，但仍然参与热力图和历史统计。
- SQLite 运行在 `WAL` 模式下，更适合 Windows 本地开发环境中的并发读写。

## 你会看到什么

### 饮食与运动记录

- 手动记录每日饮食和运动
- 食物专属单位换算
- 图片识别后自动补全热量和营养信息

### AI 健康分析

- 输出 `health_score`、`alert_level`、`analysis_report`
- 支持日报与周报聚合分析
- 前端通过 `NutritionInsightCard` 等组件展示结构化结果

### 身体指标与禁食管理

- 体重、围度、照片记录
- 身体前后对比
- 禁食状态、阶段和进度追踪

### 自律打卡

- 今日待办任务
- 热力图可视化
- 30 天趋势曲线
- 当前连续天数与历史最佳连续天数

### 语音优先记录

- 服务端语音转写
- 中文自然语言混合提取
- 批量确认后写入日志
- 缺失单位时的 AI 补偿恢复

## 技术栈

### 前端

- `React 19`
- `Vite`
- `TypeScript`
- `Recharts`
- `Motion`

### 后端

- `Express`
- `better-sqlite3`
- `Node.js`
- 自定义 AI 编排服务

### AI / 多模态能力

- 图像理解模型
- 文本推理模型
- 服务端语音转写链路
- 结构化信息抽取与回退策略

## 关键工程设计

### 1. 结构化 AI 链路

- 视觉模型先做图像理解和食物描述。
- 推理模型再做结构化 JSON、营养估算、健康评分和分析报告。
- 这样做的目的，是降低多模态模型一步输出复杂结构时的格式漂移风险。

### 2. 语音日志可落库

- 服务端将 STT、结构化提取、人工确认、批量写入拆成独立阶段。
- 缺失食物单位时，会让 AI 自动补估并重试提交。
- 如果恢复失败，系统会优雅降级，而不是整批写入失败。

### 3. 业务规则被显式建模

- 自律页使用独立路由，避免刷新丢状态。
- `current_streak` 做了容错设计，`max_streak` 在归档后仍保留。
- 归档习惯不会污染当前任务，但会保留历史统计价值。

### 4. 本地数据边界清晰

- `food_units` 绑定具体 `food_id`，避免单位换算错误。
- `habit_logs` 使用 `UNIQUE(habit_id, date)` 约束单日唯一状态。
- SQLite 运行在 `WAL` 模式下，更适合 Windows 本地开发环境。

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
- `src/server/aiService.ts`：模型调用、Prompt 组织、结构化解析和失败回退。
- `src/server/voiceService.ts`：中文语音文本抽取与规则解析。
- `src/server/voiceTranscriptionService.ts`：服务端 STT 提供方与模型回退编排。
- `src/App.tsx`：前端主入口与主流程编排。

## AI 工作流

### 图片链路

1. 用户上传食物图片。
2. 视觉模型生成描述与候选信息。
3. 推理模型输出结构化营养数据和健康分析。
4. 前端渲染识别结果与分析卡片。

### 语音链路

1. `/api/voice/transcribe` 完成语音转文本。
2. `/api/voice/extract` 将文本转成结构化候选项。
3. 用户确认结果。
4. `/api/voice/commit` 批量写入。
5. 若缺少单位，系统自动补偿并重试。

## 截图预览

> 仓库中保留了多张真实页面截图，下面列出核心模块。

| 模块 | 预览 |
| --- | --- |
| Dashboard | [dashboard.png](./docs/screenshots/dashboard.png) |
| 饮食/运动日志 | [logs.png](./docs/screenshots/logs.png) |
| AI 日报分析 | [analytics-daily.png](./docs/screenshots/analytics-daily.png) |
| AI 周报分析 | [analytics-weekly.png](./docs/screenshots/analytics-weekly.png) |
| 身体指标 | [body-metrics.png](./docs/screenshots/body-metrics.png) |
| 身体对比 | [body-comparison.png](./docs/screenshots/body-comparison.png) |
| 禁食追踪 | [fasting.png](./docs/screenshots/fasting.png) |
| 自律模块 | [discipline.png](./docs/screenshots/discipline.png) |
| 拍照识别 | [photo-identify-1.png](./docs/screenshots/photo-identify-1.png), [photo-identify-2.png](./docs/screenshots/photo-identify-2.png) |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，再补齐模型提供方配置。

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

## 主要接口

### AI 与分析

- `POST /api/ai/generate`
- `GET /api/health`
- `GET /api/ai/health-check`
- `GET /api/analytics/daily`
- `GET /api/analytics/weekly`

### 语音记录

- `POST /api/voice/transcribe`
- `POST /api/voice/extract`
- `POST /api/voice/commit`

### 饮食与日志

- `GET /api/foods/search`
- `POST /api/foods`
- `GET /api/logs/:date`
- `POST /api/logs/:type`
- `PUT /api/logs/:id`

### 身体指标

- `GET /api/body-metrics`
- `POST /api/body-metrics`
- `DELETE /api/body-metrics/:id`

### 禁食

- `GET /api/fasting/current`
- `POST /api/fasting/start`
- `POST /api/fasting/end`

### 自律

- `GET /api/habits`
- `POST /api/habits`
- `PUT /api/habits/:id`
- `PATCH /api/habits/:id/archive`
- `GET /api/habits/today`
- `POST /api/habits/:id/check-in`
- `GET /api/habits/heatmap`
- `GET /api/habits/:id/history`

## 这个项目真正难的地方

如果你正在思考“这个项目真正难的地方是什么”，可以看这几项：

1. 如何把图片识别、语音转写、文本推理三条能力链路，统一接入一个稳定的数据模型？
2. 如何让模型输出尽量结构化，同时在失败时还能优雅回退？
3. 如何在本地 SQLite 环境下，维持较清晰的数据边界和业务约束？
4. 如何把健康分析从“能生成一段话”提升到“能进入产品主流程并被用户消费”？

这些问题本质上都指向同一个主题：你是在做“AI 能力展示”，还是在做“AI 能力产品化”？这个仓库更偏后者。

## 验证方式

### 类型检查

```bash
npm run lint
```

当前 `lint` 实际执行的是：

```bash
tsc --noEmit
```

### 建议回归检查

1. 配置文本模型和视觉模型后，调用 `GET /api/health`。
2. 上传食物图片，检查图片识别、结构化营养输出和分析卡片渲染是否正常。
3. 执行一次语音记录，检查转写、抽取、确认、提交链路是否闭环。
4. 在自律页完成一次打卡，检查 `current_streak`、热力图和趋势图是否同步更新。

## Roadmap

- [ ] 增加更完整的模型提供方切换和观测日志
- [ ] 将当前 hash 路由逐步迁移到更完整的路由体系
- [ ] 增加更系统的自动化测试
- [ ] 增加更细粒度的健康趋势解释和异常提示
- [ ] 支持更强的用户画像与个性化建议

## 适合用于什么场景

这个仓库比较适合以下用途：

1. 作为前后端一体化项目作品，展示完整交付能力。
2. 作为大模型应用方向的求职项目，展示多模态和结构化输出经验。
3. 作为后续扩展 RAG、Agent、健康建议系统、用户建模系统的基础工程。

继续往下做，还能自然演进到模型观测、长期趋势建模、个性化建议生成等方向。

## License

当前仓库未看到明确的开源许可证文件。

如果你计划把它作为公开开源项目长期运营，是否应该补一个 `LICENSE`？如果没有许可证，别人 technically 可以看代码，但很难明确知道是否允许复制、修改和商用。
