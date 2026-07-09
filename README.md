# Extended ChatGPT Desktop Client Wrapper (ChatGPT-EX)

A native Electron desktop wrapper that opens ChatGPT in an app window.

## Features

- Bottom-right refresh button for reloading ChatGPT from inside the app window.
- Bottom-right Markdown export button for saving the currently rendered chat as `chatgpt-export-YYYY-MM-DDTHH-MM-SS.md`.
- Bottom-right PDF export button for saving the currently rendered chat as `chatgpt-export-YYYY-MM-DDTHH-MM-SS.pdf`.
- Bottom-right print button for printing the currently rendered chat.
- F5 reload shortcut.
- Right-click context menu with cut, copy, paste, and select-all actions.
- System tray icon while running; closing the window hides it to the tray.
- Tray menu with show, clear browsing data, about, and quit actions.
- Tray settings for close-to-tray, start minimized, and always-on-top behavior.
- Spell checking is disabled in the app window.

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
- NSIS installer: `ChatGPT-EX Setup <version>.exe`
- Portable executable: `ChatGPT-EX <version>.exe`
- Unpacked app: `win-unpacked/ChatGPT-EX.exe`

Windows builds use `build/icons/icon.ico` for the installer, portable executable, and unpacked `ChatGPT-EX.exe` icon.

## Icon Attribution

Some UI icons are from [Tabler Icons](https://tabler.io/icons), licensed under the MIT License. See [`build/icons/LICENSE-ICONS`](build/icons/LICENSE-ICONS).
