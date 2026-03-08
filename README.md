# FitTrack-AI

FitTrack-AI 是一个基于 `React + Express + SQLite` 的营养记录与行为管理系统。项目围绕“记录、识别、分析、反馈”构建闭环，覆盖饮食录入、运动日志、身体档案、轻断食、自律追踪与双轨 AI 分析。

## 技术亮点

1. 双轨 AI 架构
   - 视觉链路负责图片理解与食物描述。
   - 推理链路负责结构化 JSON、营养估算、膳食平衡建议和文本报告。
   - 通过“看图描述 -> 结构化推理”的两步流水线，降低多模态模型直接输出复杂 JSON 时的失败率。

2. 独立路由架构
   - 自律模块已从单纯的 tab 状态切换中剥离。
   - 当前采用 `hash route` 形式独立挂载 `#/discipline`，刷新页面后仍能保持在目标页。
   - 这种做法不引入额外路由依赖，但已经具备独立页面的行为边界，便于后续迁移到 `react-router-dom`。

3. 自律容错连胜算法
   - `GET /api/habits/today` 会返回每个习惯的 `current_streak`。
   - 算法定义为：今天已完成则从今天回溯；今天未完成但昨天已完成，则从昨天回溯；否则连胜为 0。
   - 历史接口还会返回 `max_streak`，即该习惯全量历史中的最长连胜记录。

4. 数据边界清晰
   - 已归档习惯不会出现在“今日任务”。
   - 已归档习惯的历史日志仍参与热力图与最长连胜统计，避免用户历史努力被抹除。

5. 食物专属单位换算
   - 每个单位必须绑定 `food_id`。
   - 计算严格遵循 `amount * grams_per_unit -> totalWeight -> per_100g` 的链式公式。

## 核心能力

1. 饮食与运动记录
   - 支持按日期记录饮食和运动日志
   - 支持食物专属单位换算
   - 支持图片识别后的热量与三大营养素预填

2. 膳食平衡建议
   - 输出 `health_score`、`alert_level`、`analysis_report`
   - 前端以 `NutritionInsightCard` 展示营养建议和 P/C/F 比例

3. 身体档案与轻断食
   - 身体围度与照片时间轴
   - 双栏照片对比视图
   - 轻断食状态、阶段与进度环

4. 自律模块
   - 今日任务列表
   - 自律热力图
   - 单项习惯 30 天趋势曲线
   - 当前连胜与最长连胜统计

## 项目结构

### 前端

- `src/App.tsx`
  - 主入口，负责数据加载、首页聚合视图、独立路由切换
- `src/components/`
  - 复用组件，如 `LogForm`、`NutritionInsightCard`、`HabitHeatmap`、`HabitTrendCurve`
- `src/pages/`
  - 页面级组件，如 `SelfDisciplinePage`

### 后端

- `server.ts`
  - Express 路由入口
  - 负责 REST API、AI 调用编排、健康检查、静态资源服务
- `src/server/db.ts`
  - SQLite schema 初始化与数据访问层
- `src/server/aiService.ts`
  - AI 提示词、模型归一化、结构化解析与错误归类
- `src/server/bodyMetricsService.ts`
  - 身体档案图片落盘与 CRUD 封装
- `src/server/fastingService.ts`
  - 轻断食状态计算与业务逻辑

## 数据库设计

SQLite 启用 `WAL` 模式，适配 Windows 环境下的并发读写。

主要表：

1. `users`
2. `foods`
3. `food_units`
4. `logs`
5. `body_metrics`
6. `fasting_logs`
7. `habits`
8. `habit_logs`

其中：

- `food_units` 的单位必须绑定具体 `food_id`
- `habit_logs` 通过 `UNIQUE(habit_id, date)` 保证每日习惯状态唯一

## 环境变量

项目运行时配置以服务端环境变量为主，前端不直接持有密钥。

### 基础变量

```env
PORT=3000
NODE_ENV=development
```

### 引擎配置

```env
GEMINI_API_KEY=
GEMINI_BASE_URL=

ZHIPU_API_KEY=
ZHIPU_BASE_URL=
ZHIPU_TEXT_MODEL=glm-4
ZHIPU_VISION_MODEL=glm-4.5v

TONGYI_API_KEY=
TONGYI_BASE_URL=
TONGYI_TEXT_MODEL=qwen-mt-plus
TONGYI_VISION_MODEL=qwen-vl-plus

SILRA_API_KEY=
SILRA_BASE_URL=https://api.silra.cn/v1
SILRA_TEXT_MODEL=deepseek-v3
SILRA_VISION_MODEL=qwen-vl-plus
```

说明：

1. 文本模型与视觉模型是分开配置的。
2. `Silra` 作为兼容网关时，视觉模型必须选择真正支持图片输入的模型，例如 `qwen-vl-plus`、`glm-4.5v` 或 `gemini-3.1-pro-preview`。
3. 不要把 `deepseek-v3`、`deepseek-chat` 这类纯文本模型写入视觉链路。

## 开发启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`，填写实际的服务商密钥与模型配置。

### 3. 启动开发环境

```bash
npm run dev
```

默认情况下：

- 前端页面由 Vite 提供
- API 由 Express 提供
- SQLite 数据库位于 `db/fittrack.db`

## 关键 API

### AI

- `POST /api/ai/generate`
- `GET /api/health`
- `GET /api/ai/health-check`

### 食物与日志

- `GET /api/foods/search`
- `POST /api/foods`
- `GET /api/logs/:date`
- `POST /api/logs/:type`
- `PUT /api/logs/:id`

### 身体档案

- `GET /api/body-metrics`
- `POST /api/body-metrics`
- `DELETE /api/body-metrics/:id`

### 轻断食

- `GET /api/fasting/current`
- `POST /api/fasting/start`
- `POST /api/fasting/end`

### 自律模块

- `GET /api/habits`
- `POST /api/habits`
- `PUT /api/habits/:id`
- `PATCH /api/habits/:id/archive`
- `GET /api/habits/today`
- `POST /api/habits/:id/check-in`
- `GET /api/habits/heatmap`
- `GET /api/habits/:id/history`

## 自律模块说明

### 今日任务列表

`GET /api/habits/today` 返回：

- 当日日期
- 已完成数
- 总目标数
- 每个习惯的状态
- `current_streak`

### 热力图

`GET /api/habits/heatmap?days=90` 返回按日聚合后的：

- `completed`
- `total`
- `rate`
- `level (0-4)`

颜色越深，表示当日完成率越高。

### 单项趋势图

`GET /api/habits/:id/history?days=30` 返回：

- 连续补全后的 30 天状态数组
- `max_streak`

缺失日期会由后端自动补成 `pending`，保证前端折线图横轴连续。

## 验证

### 类型检查

```bash
npm run lint
```

当前 `lint` 实际执行：

```bash
tsc --noEmit
```

### 建议回归点

1. 保存文本/视觉模型配置后执行一次 `GET /api/health`
2. 上传食物图片，确认图片识别、结构化结果、膳食建议卡片都能回填
3. 在自律页完成一条习惯，确认：
   - 今日完成数刷新
   - `current_streak` 更新
   - 卡片动画触发
   - 热力图与趋势图状态一致

## License

在你自己的项目环境中使用前，请确认所接入模型服务、图片数据和第三方依赖的许可与合规要求。
