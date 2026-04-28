<div align="center">

# FitTrack-AI

### AI-Powered Full-Stack Personal Health Tracker

Built with `React + Express + SQLite`, designed around a closed loop of log, understand, analyze, and adjust, combining nutrition, exercise, body metrics, fasting, habit tracking, and multimodal AI analysis.

[中文](./README.md) | [English](./README_EN.md)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![AI](https://img.shields.io/badge/AI-Multimodal%20Pipeline-7B61FF)
![Status](https://img.shields.io/badge/Project-Portfolio%20Ready-2EA44F)

</div>

---

> This repository is designed as a portfolio-grade AI application rather than a toy demo. It integrates image recognition, speech-to-text, structured log extraction, and daily/weekly health analytics, while explicitly handling engineering issues such as dual-engine AI orchestration, mixed voice-log persistence, missing-unit recovery, and habit streak modeling.

**Quick Links**

[Quick Start](#quick-start) · [Core Capabilities](#core-capabilities) · [Architecture Highlights](#architecture-highlights) · [Screenshots](#screenshots)

## Why It Matters

- It is a complete `React + Express + SQLite` full-stack application, not a one-feature demo.
- AI capabilities are embedded into real product workflows instead of isolated model calls.
- The project covers an end-to-end multimodal pipeline: image recognition, speech transcription, structured extraction, persistence, and analytics.
- It explicitly addresses unstable model outputs, missing unit conversions, archived history, and streak tracking.
- It works well as a portfolio project for data analysis, algorithm engineering, and LLM application roles.

## Core Capabilities

- Nutrition and exercise logging: manual logs, food-specific unit conversion, and photo-based prefilling.
- AI health analysis: `health_score`, `alert_level`, `analysis_report`, plus daily and weekly summaries.
- Body metrics and fasting: weight/body records, photo comparison, fasting progress tracking.
- Habit tracking: daily tasks, heatmap, 30-day trend, current streak, and max streak.
- Voice-first logging: server-side STT, Chinese mixed-intent extraction, review-before-write workflow.

## Architecture Highlights

### 1. Dual-engine AI pipeline

- A vision model handles image understanding, food recognition, and descriptive output.
- A reasoning model handles structured JSON, nutrition estimation, health scoring, and analysis generation.
- The two-stage flow is used to reduce schema drift compared with forcing multimodal models to do everything in one step.

### 2. Voice logs can safely persist

- The backend separates `STT -> structured extraction -> manual review -> batch persistence` into explicit stages.
- When a matched food is missing a unit, the system asks AI to estimate `grams_per_unit` and `calories_per_unit`, then retries the commit.
- If recovery still fails, the system degrades gracefully instead of failing the whole batch.

### 3. Business rules are modeled explicitly

- The discipline module is mounted as an independent route at `#/discipline`.
- `current_streak` follows a fault-tolerant rule, and `max_streak` remains available after archive.
- Archived habits are removed from active tasks but still contribute to historical analytics.

### 4. Data boundaries are clear

- `food_units` are tied to specific `food_id` values.
- `habit_logs` enforce `UNIQUE(habit_id, date)` for a single daily state.
- SQLite runs in `WAL` mode, which is practical for local Windows development.

## Screenshots

| Module | Preview |
| --- | --- |
| Dashboard | [dashboard.png](./docs/screenshots/dashboard.png) |
| Logs | [logs.png](./docs/screenshots/logs.png) |
| Daily analytics | [analytics-daily.png](./docs/screenshots/analytics-daily.png) |
| Weekly analytics | [analytics-weekly.png](./docs/screenshots/analytics-weekly.png) |
| Body metrics | [body-metrics.png](./docs/screenshots/body-metrics.png) |
| Discipline | [discipline.png](./docs/screenshots/discipline.png) |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the model provider settings:

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

### 3. Run the project

```bash
npm run dev
```

By default:

- Vite serves the frontend
- Express serves the API
- SQLite is stored at `db/fittrack.db`

## Tech Stack

- Frontend: `React 19`, `Vite`, `TypeScript`, `Recharts`, `Motion`
- Backend: `Express`, `better-sqlite3`, `Node.js`
- AI: vision models, reasoning models, server-side STT, structured extraction, and fallback strategy

## Project Structure

```text
FitTrack-AI
├─ src/
│  ├─ components/        # Reusable UI components
│  ├─ pages/             # Page-level views
│  └─ server/            # Services, database, AI orchestration
├─ docs/screenshots/     # Project screenshots
├─ db/                   # SQLite database files
├─ public/               # Static assets
└─ server.ts             # Express entry point
```

Key files:

- `server.ts`: backend entry point for APIs, static assets, AI orchestration, and health checks.
- `src/server/db.ts`: SQLite schema bootstrap and data access logic.
- `src/server/aiService.ts`: model calls, prompt orchestration, structured parsing, and fallbacks.
- `src/server/voiceService.ts`: Chinese transcript extraction and rule-based parsing.
- `src/server/voiceTranscriptionService.ts`: STT provider/model orchestration and fallback chain.
- `src/App.tsx`: frontend entry and page flow orchestration.

## Main APIs

- AI and analytics: `POST /api/ai/generate`, `GET /api/health`, `GET /api/analytics/daily`, `GET /api/analytics/weekly`
- Voice logging: `POST /api/voice/transcribe`, `POST /api/voice/extract`, `POST /api/voice/commit`
- Foods and logs: `GET /api/foods/search`, `POST /api/foods`, `GET /api/logs/:date`, `POST /api/logs/:type`
- Habits: `GET /api/habits`, `GET /api/habits/today`, `POST /api/habits/:id/check-in`, `GET /api/habits/heatmap`

## Verification

```bash
npm run lint
```

The current `lint` script runs:

```bash
tsc --noEmit
```

Suggested checks:

- Call `GET /api/health` to verify service and model availability.
- Upload a food image and verify recognition, structured nutrition output, and analysis rendering.
- Run one complete voice logging flow and verify transcription, extraction, review, and commit.
- Complete one habit check-in and verify `current_streak`, heatmap, and trend updates.

## Roadmap

- [ ] Add stronger model-provider switching and observability
- [ ] Gradually migrate from hash-based routing to a fuller routing system
- [ ] Add more systematic automated testing
- [ ] Improve trend explanation and anomaly detection
- [ ] Support richer user profiling and personalized recommendations

## License

No explicit open-source license file is currently included. If you plan to maintain this as a public project, adding a `LICENSE` file is recommended.
