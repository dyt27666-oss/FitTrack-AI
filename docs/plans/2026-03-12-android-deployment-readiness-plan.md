# Android Deployment Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare FitTrack-AI for Android app packaging by normalizing API/resource URLs and reserving a dual-channel voice architecture.

**Architecture:** Add a shared frontend URL utility, migrate page-level fetches toward it, normalize uploaded asset URLs, and refactor the voice modal to expose browser/server modes while keeping browser STT as the active Web path.

**Tech Stack:** React, TypeScript, Vite, Express, SQLite, browser SpeechRecognition

---

### Task 1: Add deployment-safe URL utilities

**Files:**
- Create: `src/utils/runtimeUrls.ts`
- Test: `src/utils/__tests__/runtimeUrls.test.ts`

**Step 1: Write failing tests**
- test API URL resolution with and without `VITE_API_BASE_URL`
- test asset URL normalization for relative and absolute URLs

**Step 2: Run tests to verify failure**
Run: `node --import tsx --test "E:/Github/FitTrack-AI/src/utils/__tests__/runtimeUrls.test.ts"`

**Step 3: Implement minimal helpers**
- `buildApiUrl(path)`
- `resolveAssetUrl(path)`

**Step 4: Re-run tests**

### Task 2: Migrate frontend client layer to URL utility

**Files:**
- Modify: `src/services/aiClient.ts`

**Step 1: Add tests only if helper behavior changes**

**Step 2: Refactor request helpers**
- make `requestJson` use `buildApiUrl`
- remove active reliance on `/api/voice/transcribe`

**Step 3: Re-run URL tests and lint**

### Task 3: Refactor voice modal for deployment-safe dual-mode reservation

**Files:**
- Modify: `src/components/VoiceLogModal.tsx`
- Modify: `src/types.ts`

**Step 1: Add or update types**
- `VoiceInputMode`
- `VoiceEngineAvailability`

**Step 2: Rewrite modal strings and mode handling**
- keep active mode `browser`
- show server mode as reserved
- preserve transcript edit, extract, review, commit

**Step 3: Verify no frontend regression**
Run: `npm.cmd run lint`

### Task 4: Normalize dashboard and page fetch usage

**Files:**
- Modify: `src/App.tsx`
- Modify: any directly affected components if asset URL rendering changes

**Step 1: Replace direct relative API fetches where practical**
- profile
- logs
- fasting
- body metrics
- units
- foods

**Step 2: Normalize image/resource rendering through helper**

**Step 3: Re-run lint**

### Task 5: Reserve backend mobile STT contract and docs

**Files:**
- Modify: `server.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Step 1: Clarify `/api/voice/transcribe` as reserved mobile entry**
**Step 2: Add `VITE_API_BASE_URL` to `.env.example`**
**Step 3: Add deployment-readiness section to README**

### Task 6: Final verification and push

**Files:**
- Modify: staged changes only

**Step 1: Run tests**
- `node --import tsx --test "E:/Github/FitTrack-AI/src/server/__tests__/voiceService.test.ts"`
- `node --import tsx --test "E:/Github/FitTrack-AI/src/utils/__tests__/runtimeUrls.test.ts"`
- `npm.cmd run lint`

**Step 2: Commit**
- `git add ...`
- `git commit -m "feat: prepare app for Android deployment and voice fallback"`

**Step 3: Push**
- `git push origin main`
