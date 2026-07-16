# AGENTS.md

## Commands
- Use npm; the lockfile is `package-lock.json`. Electron 43 requires Node.js 22.12.0 or newer.
- Install dependencies with `npm install` locally or `npm ci` for a clean CI-equivalent install.
- Run the app with `npm start` or `npm run dev`; both execute `electron .`.
- Build Linux artifacts with `npm run build:linux` or `npm run release:linux`; outputs go to ignored `dist/` as AppImage and deb packages.
- Build Windows artifacts with `npm run build:win` or `npm run release:win`; configured targets are NSIS installer and portable exe.
- Windows config disables built-in exe resource editing and uses `scripts/after-pack-win.js` to run the split `rcedit` bundle for `ChatGPT-EX.exe` icon and display metadata updates.
- There are no configured lint, test, formatter, or typecheck scripts in `package.json`.

## App Structure
- `package.json` sets Electron's main entrypoint to `main.js`; keep packaged runtime files in `build.files` if adding new required files.
- `main.js` acquires a single-instance lock that restores the existing window on a second launch; it also creates the BrowserWindow and Tray, loads `https://chatgpt.com`, blocks new-window navigation by opening external URLs via `shell.openExternal`, handles F5 reload and F12 DevTools, hides to tray on window close when enabled, clears ChatGPT session data from the tray menu, persists tray, compatibility, voice/microphone, and export settings in Electron's `userData/settings.json`, configures explicit media permission handlers, and injects the Markdown export, HTML export, PDF export, print, and refresh buttons on `dom-ready`; exports default to `chatgpt-export-YYYY-MM-DDTHH-MM-SS.md`, `.html`, or `.pdf` using local time.
- Compatibility Mode is a persisted boolean setting that applies a Chrome-like user agent using Electron's embedded Chromium version before loading ChatGPT and reloads ChatGPT when toggled. Keep it positioned as a compatibility aid, not a login-bypass feature.
- Voice/Microphone Access is a persisted boolean setting for microphone/recording input. Keep microphone permissions opt-in, allow ChatGPT speaker/audio-output permissions and sanitized clipboard writes, and answer denied media requests immediately when disabled to avoid ChatGPT voice settings hangs.
- Export preferences live under `settings.exportPreferences`: default folder, timestamp visibility, role heading visibility, PDF page size, and save-without-dialog behavior. Keep Markdown/PDF/print formatting in sync when changing these options.
- Preserve the BrowserWindow hardening unless intentionally changing security posture: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- `preload.js` exposes only `window.chatgptDesktop.getExportPreferences`, `window.chatgptDesktop.saveMarkdown`, `window.chatgptDesktop.saveHtml`, `window.chatgptDesktop.savePdf`, and `window.chatgptDesktop.printConversation`; the current UI injection lives in `main.js` via `webContents.executeJavaScript`.
- Floating action icons are packaged Tabler SVG assets under `build/icons/`; keep required runtime icon files included by `build.files` and keep icon attribution in `README.md` plus `build/icons/LICENSE-ICONS`.
- Linux and Windows packaging configuration live in `package.json` under `build`; Windows uses `build/icons/icon.ico` and the `afterPack` hook to update the unpacked exe icon.
