# Comprehensive Health Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build structured daily and weekly AI health analytics while converting the meal analysis card into a continuous long-form report layout.

**Architecture:** Keep numeric aggregation deterministic in Express/SQLite and use the text engine only for report synthesis. The meal report remains scoped to a single recognition result, while the homepage AI analytics panel aggregates daily and weekly cross-domain signals.

**Tech Stack:** React 19, TypeScript, Express, SQLite (better-sqlite3), motion/react, lucide-react.

---

### Task 1: Define analytics report types and prompt builders

**Files:**
- Modify: `E:/Github/FitTrack-AI/src/types.ts`
- Modify: `E:/Github/FitTrack-AI/src/server/aiService.ts`

**Step 1:** Add typed report interfaces for daily/weekly analytics.
**Step 2:** Add `buildDailyHolisticInsightPrompt` and `buildWeeklyHealthReportPrompt`.
**Step 3:** Ensure both prompts require strict JSON sections and concrete recommendations.

### Task 2: Implement analytics aggregation routes

**Files:**
- Modify: `E:/Github/FitTrack-AI/server.ts`
- Reference: `E:/Github/FitTrack-AI/src/server/db.ts`

**Step 1:** Add deterministic aggregation helpers for daily nutrition/activity/discipline data.
**Step 2:** Add weekly aggregation helpers for 7-day trends, streaks, and risky windows.
**Step 3:** Add `GET /api/analytics/daily`.
**Step 4:** Add `GET /api/analytics/weekly`.
**Step 5:** Add structured fallback responses for sparse data and AI failures.

### Task 3: Add client fetchers

**Files:**
- Modify: `E:/Github/FitTrack-AI/src/services/aiClient.ts`

**Step 1:** Add `fetchDailyHealthInsight()`.
**Step 2:** Add `fetchWeeklyHealthReport()`.
**Step 3:** Normalize empty section fields into render-safe defaults.

### Task 4: Replace homepage AI advice block

**Files:**
- Modify: `E:/Github/FitTrack-AI/src/App.tsx`
- Create: `E:/Github/FitTrack-AI/src/components/HealthAnalyticsPanel.tsx`

**Step 1:** Add analytics state and loading state to `App.tsx`.
**Step 2:** Create `HealthAnalyticsPanel` with two tabs: 今日健康洞察 / 本周健康周报.
**Step 3:** Render long-form report sections with monospaced metrics.
**Step 4:** Replace the old `advice` string card.

### Task 5: Refactor meal report UI

**Files:**
- Modify: `E:/Github/FitTrack-AI/src/components/NutritionInsightCard.tsx`

**Step 1:** Remove nested white tiles and floating inner cards.
**Step 2:** Convert to one continuous report container.
**Step 3:** Use section dividers and denser report typography.

### Task 6: Documentation and verification

**Files:**
- Create: `E:/Github/FitTrack-AI/docs/VISION_ENGINE_SPEC.md`

**Step 1:** Document behavior-data + nutrition-data covariance logic and system boundaries.
**Step 2:** Run `npm.cmd run lint`.
**Step 3:** Manually verify homepage analytics tab switch and image recognition report rendering.
