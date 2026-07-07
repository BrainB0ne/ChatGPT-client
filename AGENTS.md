# AGENTS.md

## Commands
- Use npm; this repo has `package-lock.json` and CI runs `npm ci` on Node 20.
- Install dependencies with `npm install` locally or `npm ci` for a clean CI-equivalent install.
- Run the app with `npm start` or `npm run dev`; both execute `electron .`.
- Build Linux artifacts with `npm run build:linux`; outputs go to ignored `dist/` as AppImage and deb packages.
- There are no configured lint, test, formatter, or typecheck scripts in `package.json`.

## App Structure
- `package.json` sets Electron's main entrypoint to `main.js`; keep packaged runtime files in `build.files` if adding new required files.
- `main.js` creates the BrowserWindow, loads `https://chatgpt.com`, blocks new-window navigation by opening external URLs via `shell.openExternal`, handles F5 reload, and injects the refresh button on `dom-ready`.
- Preserve the BrowserWindow hardening unless intentionally changing security posture: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- `preload.js` is intentionally minimal; the current UI injection lives in `main.js` via `executeJavaScript`.
- Linux packaging configuration and icon paths live in `package.json` under `build`; icons are in `build/icons/`.

## Releases
- GitHub Actions release workflow runs only for tags matching `v*`.
- Release CI uses `npm ci`, `npm run build:linux`, then `node scripts/generate-release-notes.js release-notes.md`.
- Release notes are generated from commits after `package.json` `releaseNotes.fromHash`; update that hash deliberately when changing the release baseline.
