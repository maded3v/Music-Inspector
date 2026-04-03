# Project Context (Local Notes)

Purpose: music review app where users can add releases/tracks and post reviews.

## High-level architecture

- Frontend: static files in `public/` (vanilla JS modules, HTML pages, CSS)
- API: Express handlers in `api/`
- DB: Postgres via `api/db.js`
- Deploy targets:
  - Vercel: static frontend + serverless API (`vercel.json` -> `api/index.js`)
  - Render: full Node server (`server.js`) serving both API + static

## Important directories

- `public/js/` - client modules (`api.js`, cards, auth, pages)
- `api/` - route handlers and middleware
- `api/utils/` - helpers (csrf, image processing, db helpers)
- `migrations/` - schema/data migrations
- `scripts/` - maintenance and one-off scripts

## Auth and session

- Cookie-based auth token (`token`)
- CSRF token in cookie (`csrf_token`) + header (`x-csrf-token`) for unsafe methods
- `getCurrentUser` endpoint: `GET /api/user/current`
- Frontend auth status UI: `public/js/auth-status.js`

## Media and image flow

- Upload endpoints:
  - `POST /api/upload/cover`
  - `POST /api/upload/artist`
  - `POST /api/upload/avatar`
- Image processing and storage: `api/utils/imageProcessor.js`
- In production, media usually stored in Vercel Blob and DB stores URL/path.

### Recent media fixes

- `public/js/api.js`:
  - normalized legacy media paths
  - added typed resolvers:
    - `resolveCoverUrl`
    - `resolveAvatarUrl`
    - `resolveArtistUrl`
  - guarded `MI_API_BASE` override (local dev only)
  - set same-origin API for `*.vercel.app` / `*.vercel.com` / `*.onrender.com`
- Added media proxy endpoint:
  - `GET /api/media?url=<blob-url>` in `api/media.js`
  - wired in `api/index.js` and `server.js`
  - frontend uses proxy for blob URLs on Vercel to avoid direct blob connection failures

## Why avatars/covers could fail before

- Not a save issue; mostly a delivery issue.
- Browser requested blob host directly and got network errors (`ERR_CONNECTION_CLOSED`).
- Some legacy path formats were not normalized consistently.
- Cache/version mismatch between modules could keep old URL logic alive.

## Quick debug checklist

1. In console, verify API base:
   - `import('/js/api.js?v=20260412').then(m => console.log(m.API_BASE))`
2. Check user payload:
   - `GET /api/user/current` -> `user.avatar`
3. Validate resolved URL points to `/api/media?...` on Vercel.
4. Test media endpoint directly with one URL.
5. Hard refresh (`Ctrl+F5`) after module version bump.

## Useful files to read first when returning later

- `public/js/api.js`
- `public/js/main.js`
- `public/js/reviews.js`
- `public/js/components/releaseCard.js`
- `api/index.js`
- `api/media.js`
- `api/upload.js`
- `server.js`
