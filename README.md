# ChatGPT Electron Wrapper

A native Electron desktop wrapper that opens ChatGPT in an app window.

## Features

- Bottom-right refresh button for reloading ChatGPT from inside the app window.
- Bottom-right Markdown export button for saving the currently rendered chat as `chatgpt-export-YYYY-MM-DDTHH-MM-SS.md`.
- F5 reload shortcut.
- Right-click context menu with cut, copy, paste, and select-all actions.
- System tray icon while running; closing the window hides it to the tray.
- Tray menu with show, clear browsing data, about, and quit actions.
- Spell checking is disabled in the app window.

## Developer

- Stephan Coertzen `<coertzen.jfs@gmail.com>`

## Prerequisites (Ubuntu)

```bash
sudo apt update
sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2
```

## Install

```bash
npm install
```

## Run the app

```bash
npm start
```

## Build Linux packages

```bash
npm run build:linux
```

Build outputs are generated in `dist/`:
- `.AppImage`
- `.deb`

## Build Windows packages

Run this on Windows:

```bash
npm run build:win
```

Build outputs are generated in `dist/`:
- NSIS installer: `ChatGPT Setup <version>.exe`
- Portable executable: `ChatGPT <version>.exe`
- Unpacked app: `win-unpacked/ChatGPT.exe`

Windows builds use `build/icons/icon.ico` for the installer, portable executable, and unpacked `ChatGPT.exe` icon.

## GitHub Release Flow

Pushing a version tag (for example `v1.0.1`) triggers automated Linux builds and publishes a GitHub Release with attached artifacts. The release page notes are generated from every commit after `releaseNotes.fromHash` in `package.json`.

```bash
git add .
git commit -m "release: v1.0.1"
git tag v1.0.1
git push origin main --tags
```
