# Extended ChatGPT Desktop Client Wrapper (ChatGPT-EX)

A native Electron desktop wrapper that opens ChatGPT in an app window.

This project is a fork of the original ChatGPT-client application.

## Features

- Bottom-right refresh button for reloading ChatGPT from inside the app window.
- Bottom-right Markdown export button for saving the currently rendered chat as `chatgpt-export-YYYY-MM-DDTHH-MM-SS.md`.
- Bottom-right PDF export button for saving the currently rendered chat as `chatgpt-export-YYYY-MM-DDTHH-MM-SS.pdf`.
- Bottom-right print button for printing the currently rendered chat.
- Drag-and-drop file upload fallback for adding images/files to the chat prompt.
- Export preferences for default folder, timestamps, role headings, PDF page size, and saving without a dialog.
- F5 reload shortcut.
- Right-click context menu with cut, copy, paste, and select-all actions.
- System tray icon while running; closing the window hides it to the tray.
- Tray menu with show, clear browsing data, about, and quit actions.
- Tray settings for close-to-tray, start minimized, always-on-top behavior, Compatibility Mode, and Voice/Microphone Access.
- Spell checking is disabled in the app window.

## Export Preferences

Export preferences are available from the tray menu under `Settings > Export Preferences`.

- Choose a default export folder, or reset exports back to Documents.
- Include or hide export timestamps.
- Include or hide User/Assistant role headings.
- Choose the PDF page size: A4 or Letter.
- Enable saving without a dialog to write exports directly to the default folder.

## Compatibility Mode

Compatibility Mode is available from the tray menu under `Settings > Compatibility Mode`.

When enabled, ChatGPT-EX reloads ChatGPT with a Chrome-like user agent instead of Electron's default user agent. This can help with site compatibility, but it may not avoid ChatGPT login requirements because those are controlled by ChatGPT and can also depend on cookies, region, account state, experiments, or other browser signals.

## Voice/Microphone Access

Voice/Microphone Access is available from the tray menu under `Settings > Voice/Microphone Access`.

Microphone access is off by default. When disabled, ChatGPT-EX answers ChatGPT recording permission checks immediately instead of leaving microphone-related browser APIs unresolved. Speaker/audio-output access for ChatGPT is allowed so voice previews can play in settings. Enable Voice/Microphone Access only if you want to use ChatGPT recording features.

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
