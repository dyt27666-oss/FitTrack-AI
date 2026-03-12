# Android Deployment Readiness Design

**Date:** 2026-03-12

**Goal:** Prepare FitTrack-AI for future Android app packaging with Capacitor by removing browser-only assumptions from API access, resource URL handling, and voice input architecture.

## Context

The current project is a React + Vite frontend with an Express + SQLite backend. It works well as a Web app, but future Android packaging introduces constraints:

1. Frontend and backend will no longer share the same origin by default.
2. Uploaded resources must resolve to absolute URLs that work inside WebView.
3. Voice input cannot rely permanently on browser SpeechRecognition.
4. Existing extract/commit voice APIs should remain stable even if transcript generation changes.

## Design

### 1. API access normalization

Introduce a small frontend URL utility layer that resolves API requests against `VITE_API_BASE_URL` when configured, and falls back to same-origin relative requests for local development.

This utility becomes the single path for:
- API request URLs
- uploaded asset URLs returned by the backend

### 2. Resource URL normalization

Any backend-returned relative path like `/uploads/body/...` must be converted into an absolute fetchable URL through a shared helper instead of being rendered directly by components.

### 3. Voice input dual-channel reservation

Keep browser speech recognition as the active Web fallback, but formalize voice mode as:
- `browser`
- `server`

The current implementation continues to use browser STT on Web, while `/api/voice/transcribe` remains a reserved future entry for Android/native audio upload.

The stable path after transcript generation remains:
- transcript
- `/api/voice/extract`
- review
- `/api/voice/commit`

### 4. UI boundaries

Do not merge voice input into photo recognition.
Keep voice as a dedicated subsystem with its own full-width dashboard panel and modal.

### 5. Deployment documentation

Document the new deployment assumptions in README and `.env.example`, especially:
- `VITE_API_BASE_URL`
- current Web voice fallback
- future server STT reservation for mobile

## Risks

1. App.tsx currently contains many direct `fetch('/api/...')` calls. Leaving them scattered would make Android deployment brittle.
2. VoiceLogModal currently contains corrupted Chinese strings; this is both a UX issue and a maintenance risk.
3. SQLite remains acceptable for single-user or early-stage deployment, but should not be mistaken for the final multi-user backend architecture.

## Non-goals

1. Do not fully integrate Capacitor in this task.
2. Do not implement provider-specific backend STT transport in this task.
3. Do not redesign photo recognition.
