# AGENTS.md

## Commands
- Use npm; the lockfile is `package-lock.json`, and release CI runs `npm ci` on Node 20.
- Install dependencies with `npm install` locally or `npm ci` for a clean CI-equivalent install.
- Run the app with `npm start` or `npm run dev`; both execute `electron .`.
- Build Linux artifacts with `npm run build:linux` or `npm run release:linux`; outputs go to ignored `dist/` as AppImage and deb packages.
- Build Windows artifacts with `npm run build:win` or `npm run release:win`; configured targets are NSIS installer and portable exe.
- Windows config disables built-in exe resource editing and uses `scripts/after-pack-win.js` to run the split `rcedit` bundle for `ChatGPT.exe` icon updates.
- There are no configured lint, test, formatter, or typecheck scripts in `package.json`.

## App Structure
- `package.json` sets Electron's main entrypoint to `main.js`; keep packaged runtime files in `build.files` if adding new required files.
- `main.js` creates the BrowserWindow and Tray, loads `https://chatgpt.com`, blocks new-window navigation by opening external URLs via `shell.openExternal`, handles F5 reload, hides to tray on window close, clears ChatGPT session data from the tray menu, and injects the refresh/export buttons on `dom-ready`; Markdown exports default to `chatgpt-export-YYYY-MM-DDTHH-MM-SS.md`.
- Preserve the BrowserWindow hardening unless intentionally changing security posture: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- `preload.js` exposes only `window.chatgptDesktop.saveMarkdown`; the current UI injection lives in `main.js` via `webContents.executeJavaScript`.
- Linux and Windows packaging configuration live in `package.json` under `build`; Windows uses `build/icons/icon.ico` and the `afterPack` hook to update the unpacked exe icon.
