/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, session, shell } = require('electron');
const { mkdir, readFile, writeFile } = require('fs/promises');
const { join } = require('path');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const DEFAULT_SETTINGS = {
  closeToTray: true,
  startMinimized: false,
  alwaysOnTop: false
};

let settings = { ...DEFAULT_SETTINGS };

const ACTION_BUTTONS_SCRIPT = `
(() => {
  const hostId = 'chatgpt-desktop-actions-host';

  if (document.getElementById(hostId)) {
    return;
  }

  const host = document.createElement('div');
  host.id = hostId;
  host.style.position = 'fixed';
  host.style.bottom = '44px';
  host.style.right = '24px';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = [
    ':host { display: block; }',
    '.actions { display: flex; gap: 8px; }',
    'button {',
    '  align-items: center;',
    '  background: rgba(255, 255, 255, 0.92);',
    '  border: 1px solid rgba(0, 0, 0, 0.16);',
    '  border-radius: 8px;',
    '  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);',
    '  color: #111827;',
    '  cursor: pointer;',
    '  display: inline-flex;',
    '  height: 36px;',
    '  justify-content: center;',
    '  padding: 0;',
    '  width: 36px;',
    '}',
    'button[disabled] { cursor: progress; opacity: 0.65; }',
    'button:hover { background: #ffffff; }',
    'button:active { transform: translateY(1px); }',
    'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
    'svg { height: 18px; width: 18px; }',
    '@media (prefers-color-scheme: dark) {',
    '  button {',
    '    background: rgba(31, 41, 55, 0.92);',
    '    border-color: rgba(255, 255, 255, 0.2);',
    '    color: #f9fafb;',
    '  }',
    '  button:hover { background: #374151; }',
    '}'
  ].join('\\n');

  function createIcon(paths) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }

    return svg;
  }

  function createButton(title, label, paths) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', label);
    button.appendChild(createIcon(paths));
    return button;
  }

  function cleanText(text) {
    return text
      .replace(/\\u00a0/g, ' ')
      .replace(/[ \\t]+\\n/g, '\\n')
      .replace(/\\n{3,}/g, '\\n\\n')
      .trim();
  }

  function textWithCodeBlocks(element) {
    const clone = element.cloneNode(true);

    for (const removable of clone.querySelectorAll('button, svg, form, textarea, script, style, [contenteditable="true"]')) {
      removable.remove();
    }

    for (const pre of clone.querySelectorAll('pre')) {
      const code = pre.querySelector('code');
      const language = code?.className?.match(/language-([^\\s]+)/)?.[1] || '';
      const text = cleanText((code || pre).innerText || '');
      pre.replaceWith(document.createTextNode('\\n\`\`\`' + language + '\\n' + text + '\\n\`\`\`\\n'));
    }

    return cleanText(clone.innerText || '');
  }

  function findRenderedMessages() {
    const roleNodes = Array.from(document.querySelectorAll('[data-message-author-role]'));

    if (roleNodes.length > 0) {
      return roleNodes.map(node => ({
        role: node.getAttribute('data-message-author-role') || 'message',
        node
      }));
    }

    return Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]')).map((node, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      node
    }));
  }

  function buildMarkdown() {
    const messages = findRenderedMessages()
      .map(({ role, node }) => {
        const contentNode = node.querySelector('.markdown, [data-message-id]') || node;
        return {
          role: role === 'assistant' ? 'Assistant' : role === 'user' ? 'User' : 'Message',
          text: textWithCodeBlocks(contentNode)
        };
      })
      .filter(message => message.text);

    if (messages.length === 0) {
      throw new Error('No rendered ChatGPT messages were found to export.');
    }

    const title = cleanText(document.title.replace(/\\s*[-|]\\s*ChatGPT\\s*$/i, '')) || 'ChatGPT conversation';
    const exportedAt = new Date().toISOString();
    const sections = messages.map(message => '## ' + message.role + '\\n\\n' + message.text);

    return '# ' + title + '\\n\\nExported: ' + exportedAt + '\\n\\n' + sections.join('\\n\\n---\\n\\n') + '\\n';
  }

  const refreshButton = createButton('Refresh', 'Refresh ChatGPT', [
    'M21 12a9 9 0 1 1-2.64-6.36',
    'M21 3v6h-6'
  ]);
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });

  const exportButton = createButton('Export Markdown', 'Export visible chat to Markdown', [
    'M12 3v12',
    'M7 10l5 5 5-5',
    'M5 21h14'
  ]);
  exportButton.addEventListener('click', async () => {
    try {
      exportButton.disabled = true;

      if (!window.chatgptDesktop?.saveMarkdown) {
        throw new Error('Markdown export is not available in this window.');
      }

      await window.chatgptDesktop.saveMarkdown(buildMarkdown());
    } catch (error) {
      window.alert(error.message || 'Failed to export Markdown.');
    } finally {
      exportButton.disabled = false;
    }
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(exportButton, refreshButton);

  shadow.append(style, actions);
  document.documentElement.appendChild(host);
})();
`;

function injectActionButtons(win) {
  win.webContents.executeJavaScript(ACTION_BUTTONS_SCRIPT).catch(() => {
    // The page can briefly reject injection while navigating; the next load retries it.
  });
}

function getSettingsPath() {
  return join(app.getPath('userData'), 'settings.json');
}

async function loadSettings() {
  try {
    const rawSettings = await readFile(getSettingsPath(), 'utf8');
    const parsedSettings = JSON.parse(rawSettings);

    settings = {
      ...DEFAULT_SETTINGS,
      closeToTray: typeof parsedSettings.closeToTray === 'boolean' ? parsedSettings.closeToTray : DEFAULT_SETTINGS.closeToTray,
      startMinimized: typeof parsedSettings.startMinimized === 'boolean' ? parsedSettings.startMinimized : DEFAULT_SETTINGS.startMinimized,
      alwaysOnTop: typeof parsedSettings.alwaysOnTop === 'boolean' ? parsedSettings.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop
    };
  } catch (error) {
    settings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings() {
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(getSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

async function updateSetting(key, value) {
  settings = { ...settings, [key]: value };

  if (key === 'alwaysOnTop' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(value);
  }

  try {
    await saveSettings();
  } catch (error) {
    await dialog.showMessageBox(getDialogParent(), {
      type: 'error',
      title: 'Settings Not Saved',
      message: 'Failed to save settings.',
      detail: error.message || String(error),
      buttons: ['OK']
    });
  }

  updateTrayMenu();
}

function getTrayIcon() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : '32x32.png';
  const icon = nativeImage.createFromPath(join(__dirname, 'build', 'icons', iconName));

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  return icon;
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow({ show: true });
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function showAboutDialog() {
  dialog.showMessageBox(getDialogParent(), {
    type: 'info',
    title: 'About ChatGPT',
    message: 'ChatGPT Desktop Wrapper',
    detail: `Version ${app.getVersion()}\nhttps://chatgpt.com`,
    buttons: ['OK']
  });
}

function getDialogParent() {
  return mainWindow && mainWindow.isVisible() ? mainWindow : undefined;
}

async function clearBrowsingData() {
  const { response } = await dialog.showMessageBox(getDialogParent(), {
    type: 'warning',
    title: 'Clear Browsing Data',
    message: 'Clear ChatGPT browsing data?',
    detail: 'This clears cookies, cache, local storage, IndexedDB, and service worker data. You may need to sign in again.',
    buttons: ['Cancel', 'Clear Browsing Data'],
    cancelId: 0,
    defaultId: 0
  });

  if (response !== 1) {
    return;
  }

  const targetSession = mainWindow ? mainWindow.webContents.session : session.defaultSession;
  await targetSession.clearStorageData({
    storages: [
      'cookies',
      'filesystem',
      'indexdb',
      'localstorage',
      'shadercache',
      'websql',
      'serviceworkers',
      'cachestorage'
    ]
  });
  await targetSession.clearCache();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reloadIgnoringCache();
  }

  await dialog.showMessageBox(getDialogParent(), {
    type: 'info',
    title: 'Browsing Data Cleared',
    message: 'ChatGPT browsing data has been cleared.',
    buttons: ['OK']
  });
}

function getMarkdownExportPath() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
  return join(app.getPath('documents'), `chatgpt-export-${timestamp}.md`);
}

ipcMain.handle('save-markdown-export', async (_event, markdown) => {
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new Error('No Markdown content was provided.');
  }

  const { canceled, filePath } = await dialog.showSaveDialog(getDialogParent(), {
    title: 'Export ChatGPT Conversation',
    defaultPath: getMarkdownExportPath(),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await writeFile(filePath, markdown, 'utf8');
  return { canceled: false, filePath };
});

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(getTrayIcon());
  tray.setToolTip('ChatGPT');
  updateTrayMenu();
  tray.on('click', showMainWindow);
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show ChatGPT', click: showMainWindow },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Close to Tray',
          type: 'checkbox',
          checked: settings.closeToTray,
          click: () => updateSetting('closeToTray', !settings.closeToTray)
        },
        {
          label: 'Start Minimized',
          type: 'checkbox',
          checked: settings.startMinimized,
          click: () => updateSetting('startMinimized', !settings.startMinimized)
        },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: settings.alwaysOnTop,
          click: () => updateSetting('alwaysOnTop', !settings.alwaysOnTop)
        }
      ]
    },
    { label: 'Clear Browsing Data', click: clearBrowsingData },
    { label: 'About', click: showAboutDialog },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function createWindow(options = {}) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    autoHideMenuBar: true,
    alwaysOnTop: settings.alwaysOnTop,
    show: options.show ?? !settings.startMinimized,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow = win;

  win.on('close', event => {
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault();
      win.hide();
      return;
    }

    isQuitting = true;
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') {
      event.preventDefault();
      win.webContents.reload();
    }
  });

  win.webContents.on('context-menu', () => {
    Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    ]).popup({ window: win });
  });

  win.webContents.on('dom-ready', () => {
    injectActionButtons(win);
  });

  win.loadURL('https://chatgpt.com');
}

app.whenReady().then(async () => {
  await loadSettings();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({ show: true });
    }
  });
});

app.on('window-all-closed', () => {
  if (isQuitting && process.platform !== 'darwin') {
    app.quit();
  }
});
