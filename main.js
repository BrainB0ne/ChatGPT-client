/*
 * Extended ChatGPT Desktop Client Wrapper (ChatGPT-EX)
 * Developer: BrainByteZ
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */

const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, session, shell } = require('electron');
const { readFileSync } = require('fs');
const { mkdir, readFile, writeFile } = require('fs/promises');
const { dirname, join } = require('path');

if (process.platform === 'win32') {
  app.setAppUserModelId('eu.brainbytez.chatgpt-ex');
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showMainWindow();
    }
  });
}

let mainWindow = null;
let tray = null;
let isQuitting = false;

const DEFAULT_SETTINGS = {
  closeToTray: true,
  startMinimized: false,
  alwaysOnTop: false,
  compatibilityMode: false,
  voiceAccess: false,
  exportPreferences: {
    directory: '',
    includeTimestamp: true,
    includeRoleHeadings: true,
    pageSize: 'A4',
    saveWithoutDialog: false
  }
};

const PDF_PAGE_SIZES = ['A4', 'Letter'];
const COMPATIBILITY_USER_AGENTS = {
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  win32: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
};

let settings = { ...DEFAULT_SETTINGS };
let defaultUserAgent = '';

const ACTION_BUTTON_ICONS = {
  markdown: readFileSync(join(__dirname, 'build', 'icons', 'markdown.svg'), 'utf8'),
  pdf: readFileSync(join(__dirname, 'build', 'icons', 'file-type-pdf.svg'), 'utf8'),
  print: readFileSync(join(__dirname, 'build', 'icons', 'printer.svg'), 'utf8'),
  reload: readFileSync(join(__dirname, 'build', 'icons', 'reload.svg'), 'utf8')
};

const ACTION_BUTTONS_SCRIPT = `
(() => {
  const hostId = 'chatgpt-ex-actions-host';
  const iconSvgs = {
    markdown: '__MARKDOWN_ICON__',
    pdf: '__PDF_ICON__',
    print: '__PRINT_ICON__',
    reload: '__RELOAD_ICON__'
  };

  const existingHost = document.getElementById(hostId);

  if (existingHost) {
    existingHost.remove();
  }

  const host = document.createElement('div');
  host.id = hostId;
  host.style.position = 'fixed';
  host.style.bottom = '36px';
  host.style.right = '36px';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = [
    ':host { display: block; }',
    '.actions { display: grid; gap: 8px; grid-template-columns: repeat(2, 36px); }',
    '.toast {',
    '  background: rgba(17, 24, 39, 0.94);',
    '  border-radius: 10px;',
    '  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);',
    '  color: #ffffff;',
    '  font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '  opacity: 0;',
    '  padding: 10px 12px;',
    '  pointer-events: none;',
    '  position: fixed;',
    '  right: 36px;',
    '  top: 36px;',
    '  transform: translateY(-8px);',
    '  transition: opacity 160ms ease, transform 160ms ease;',
    '  white-space: nowrap;',
    '}',
    '.toast.visible { opacity: 1; transform: translateY(0); }',
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

  function createIcon(svgMarkup) {
    const template = document.createElement('template');
    template.innerHTML = svgMarkup.trim();
    const svg = template.content.firstElementChild;
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    return svg;
  }

  function createButton(title, label, svgMarkup) {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', label);
    button.appendChild(createIcon(svgMarkup));
    return button;
  }

  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
      toast.classList.remove('visible');
      toastTimer = null;
    }, 3200);
  }

  function getDroppedFiles(event) {
    const files = Array.from(event.dataTransfer?.files || []);
    return files.filter(file => file && file.size >= 0);
  }

  function hasFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
  }

  function findFileInput(files) {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'))
      .filter(input => !input.disabled);

    if (fileInputs.length === 0) {
      return null;
    }

    const imageOnly = files.length > 0 && files.every(file => file.type.startsWith('image/'));

    return fileInputs.find(input => {
      const accept = String(input.getAttribute('accept') || '').toLowerCase();
      return imageOnly && (accept.includes('image') || accept.includes('*/*'));
    }) || fileInputs[fileInputs.length - 1];
  }

  function uploadDroppedFiles(event) {
    const files = getDroppedFiles(event);

    if (files.length === 0) {
      return;
    }

    event.preventDefault();

    const input = findFileInput(files);

    if (!input) {
      showToast('No ChatGPT upload control found.');
      return;
    }

    try {
      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(file));
      input.files = transfer.files;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      showToast(files.length === 1 ? 'File added to chat.' : files.length + ' files added to chat.');
    } catch (error) {
      showToast('File drop failed. Use the attach button.');
    }
  }

  window.addEventListener('dragover', event => {
    if (!hasFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, true);

  window.addEventListener('drop', uploadDroppedFiles);

  function cleanText(text) {
    return text
      .replace(/\\u00a0/g, ' ')
      .replace(/[ \\t]+\\n/g, '\\n')
      .replace(/\\n{3,}/g, '\\n\\n')
      .trim();
  }

  function padDatePart(value) {
    return String(value).padStart(2, '0');
  }

  function formatLocalTimestamp(date) {
    return date.getFullYear() + '-' +
      padDatePart(date.getMonth() + 1) + '-' +
      padDatePart(date.getDate()) + ' ' +
      padDatePart(date.getHours()) + ':' +
      padDatePart(date.getMinutes()) + ':' +
      padDatePart(date.getSeconds());
  }

  function inlineCodeToMarkdown(text) {
    const cleanCode = cleanText(text || '');

    if (!cleanCode) {
      return '';
    }

    const tick = String.fromCharCode(96);
    return cleanCode.includes(tick) ? tick + tick + ' ' + cleanCode + ' ' + tick + tick : tick + cleanCode + tick;
  }

  function linkToMarkdown(link) {
    const href = link.href || link.getAttribute('href') || '';
    const text = cleanText(link.innerText || link.textContent || href);

    if (!href || href.startsWith('javascript:')) {
      return text;
    }

    return '[' + (text || href).split(']').join('\\]') + '](' + href.split(')').join('%29') + ')';
  }

  function escapeMarkdownCell(text) {
    return cleanText(text || '')
      .replace(/\\|/g, '\\\\|')
      .replace(/\\n/g, '<br>');
  }

  function tableToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll('tr'))
      .map(row => Array.from(row.children)
        .filter(cell => ['TH', 'TD'].includes(cell.tagName))
        .map(cell => escapeMarkdownCell(cell.innerText)))
      .filter(row => row.length > 0);

    if (rows.length === 0) {
      return '';
    }

    const columnCount = Math.max(...rows.map(row => row.length));
    const normalizedRows = rows.map(row => [...row, ...Array(Math.max(0, columnCount - row.length)).fill('')]);
    const header = normalizedRows[0];
    const separator = Array(columnCount).fill('---');
    const body = normalizedRows.slice(1);
    const markdownRows = [header, separator, ...body].map(row => '| ' + row.join(' | ') + ' |');

    return markdownRows.join('\\n');
  }

  function listToMarkdown(list, depth = 0) {
    const ordered = list.tagName === 'OL';
    const items = Array.from(list.children).filter(child => child.tagName === 'LI');

    return items.map((item, index) => {
      const itemClone = item.cloneNode(true);

      for (const nestedList of itemClone.querySelectorAll('ul, ol')) {
        nestedList.remove();
      }

      const marker = ordered ? (index + 1) + '.' : '-';
      const indent = '  '.repeat(depth);
      const text = cleanText(itemClone.innerText || '').replace(/\\n/g, ' ');
      const nested = Array.from(item.children)
        .filter(child => ['UL', 'OL'].includes(child.tagName))
        .map(child => listToMarkdown(child, depth + 1))
        .filter(Boolean)
        .join('\\n');

      return nested ? indent + marker + ' ' + text + '\\n' + nested : indent + marker + ' ' + text;
    }).join('\\n');
  }

  function textWithCodeBlocks(element) {
    const clone = element.cloneNode(true);

    for (const removable of clone.querySelectorAll('button, svg, form, textarea, script, style, [contenteditable="true"]')) {
      removable.remove();
    }

    for (const code of clone.querySelectorAll('code')) {
      if (!code.closest('pre')) {
        code.replaceWith(document.createTextNode(inlineCodeToMarkdown(code.innerText || '')));
      }
    }

    for (const link of clone.querySelectorAll('a[href]')) {
      link.replaceWith(document.createTextNode(linkToMarkdown(link)));
    }

    for (const table of clone.querySelectorAll('table')) {
      table.replaceWith(document.createTextNode('\\n' + tableToMarkdown(table) + '\\n'));
    }

    for (const list of Array.from(clone.querySelectorAll('ul, ol')).filter(node => !node.parentElement.closest('ul, ol'))) {
      list.replaceWith(document.createTextNode('\\n' + listToMarkdown(list) + '\\n'));
    }

    for (const heading of clone.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      const level = Number(heading.tagName.slice(1));
      const text = cleanText(heading.innerText || '');

      if (text) {
        heading.replaceWith(document.createTextNode('\\n' + '#'.repeat(level) + ' ' + text + '\\n'));
      }
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

  function getConversationExport() {
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
    const exportedAt = formatLocalTimestamp(new Date());

    return { title, exportedAt, messages };
  }

  function buildMarkdown(options = {}) {
    const { title, exportedAt, messages } = getConversationExport();
    const includeTimestamp = options.includeTimestamp !== false;
    const includeRoleHeadings = options.includeRoleHeadings !== false;
    const header = ['# ' + title];
    const sections = messages.map(message => includeRoleHeadings ? '## ' + message.role + '\\n\\n' + message.text : message.text);

    if (includeTimestamp) {
      header.push('Exported: ' + exportedAt);
    }

    return header.join('\\n\\n') + '\\n\\n' + sections.join('\\n\\n---\\n\\n') + '\\n';
  }

  const refreshButton = createButton('Refresh', 'Refresh ChatGPT', iconSvgs.reload);
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });

  const exportButton = createButton('Export Markdown', 'Export visible chat to Markdown', iconSvgs.markdown);
  exportButton.addEventListener('click', async () => {
    try {
      exportButton.disabled = true;

      if (!window.chatgptDesktop?.saveMarkdown) {
        throw new Error('Markdown export is not available in this window.');
      }

      const exportPreferences = window.chatgptDesktop.getExportPreferences
        ? await window.chatgptDesktop.getExportPreferences()
        : {};

      const result = await window.chatgptDesktop.saveMarkdown(buildMarkdown(exportPreferences));

      if (!result?.canceled) {
        showToast('Markdown export saved.');
      }
    } catch (error) {
      window.alert(error.message || 'Failed to export Markdown.');
    } finally {
      exportButton.disabled = false;
    }
  });

  const pdfButton = createButton('Export PDF', 'Export visible chat to PDF', iconSvgs.pdf);
  pdfButton.addEventListener('click', async () => {
    try {
      pdfButton.disabled = true;

      if (!window.chatgptDesktop?.savePdf) {
        throw new Error('PDF export is not available in this window.');
      }

      const result = await window.chatgptDesktop.savePdf(getConversationExport());

      if (!result?.canceled) {
        showToast('PDF export saved.');
      }
    } catch (error) {
      window.alert(error.message || 'Failed to export PDF.');
    } finally {
      pdfButton.disabled = false;
    }
  });

  const printButton = createButton('Print', 'Print visible chat', iconSvgs.print);
  printButton.addEventListener('click', async () => {
    try {
      printButton.disabled = true;

      if (!window.chatgptDesktop?.printConversation) {
        throw new Error('Print is not available in this window.');
      }

      const result = await window.chatgptDesktop.printConversation(getConversationExport());

      if (!result?.canceled) {
        showToast('Print job sent.');
      }
    } catch (error) {
      window.alert(error.message || 'Failed to print conversation.');
    } finally {
      printButton.disabled = false;
    }
  });

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(printButton, refreshButton, exportButton, pdfButton);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  shadow.append(style, toast, actions);
  document.documentElement.appendChild(host);
})();
`;

function getActionButtonsScript() {
  return ACTION_BUTTONS_SCRIPT
    .replace("'__MARKDOWN_ICON__'", JSON.stringify(ACTION_BUTTON_ICONS.markdown))
    .replace("'__PDF_ICON__'", JSON.stringify(ACTION_BUTTON_ICONS.pdf))
    .replace("'__PRINT_ICON__'", JSON.stringify(ACTION_BUTTON_ICONS.print))
    .replace("'__RELOAD_ICON__'", JSON.stringify(ACTION_BUTTON_ICONS.reload));
}

function injectActionButtons(win) {
  win.webContents.executeJavaScript(getActionButtonsScript()).catch(() => {
    // The page can briefly reject injection while navigating; the next load retries it.
  });
}

function getSettingsPath() {
  return join(app.getPath('userData'), 'settings.json');
}

function normalizeExportPreferences(value = {}) {
  return {
    directory: typeof value.directory === 'string' ? value.directory : DEFAULT_SETTINGS.exportPreferences.directory,
    includeTimestamp: typeof value.includeTimestamp === 'boolean' ? value.includeTimestamp : DEFAULT_SETTINGS.exportPreferences.includeTimestamp,
    includeRoleHeadings: typeof value.includeRoleHeadings === 'boolean' ? value.includeRoleHeadings : DEFAULT_SETTINGS.exportPreferences.includeRoleHeadings,
    pageSize: PDF_PAGE_SIZES.includes(value.pageSize) ? value.pageSize : DEFAULT_SETTINGS.exportPreferences.pageSize,
    saveWithoutDialog: typeof value.saveWithoutDialog === 'boolean' ? value.saveWithoutDialog : DEFAULT_SETTINGS.exportPreferences.saveWithoutDialog
  };
}

async function loadSettings() {
  try {
    const rawSettings = await readFile(getSettingsPath(), 'utf8');
    const parsedSettings = JSON.parse(rawSettings);

    settings = {
      ...DEFAULT_SETTINGS,
      closeToTray: typeof parsedSettings.closeToTray === 'boolean' ? parsedSettings.closeToTray : DEFAULT_SETTINGS.closeToTray,
      startMinimized: typeof parsedSettings.startMinimized === 'boolean' ? parsedSettings.startMinimized : DEFAULT_SETTINGS.startMinimized,
      alwaysOnTop: typeof parsedSettings.alwaysOnTop === 'boolean' ? parsedSettings.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
      compatibilityMode: typeof parsedSettings.compatibilityMode === 'boolean' ? parsedSettings.compatibilityMode : DEFAULT_SETTINGS.compatibilityMode,
      voiceAccess: typeof parsedSettings.voiceAccess === 'boolean' ? parsedSettings.voiceAccess : DEFAULT_SETTINGS.voiceAccess,
      exportPreferences: normalizeExportPreferences(parsedSettings.exportPreferences)
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

  if (key === 'compatibilityMode' && mainWindow && !mainWindow.isDestroyed()) {
    applyCompatibilityUserAgent(mainWindow);
    mainWindow.loadURL('https://chatgpt.com');
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

function applyCompatibilityUserAgent(win) {
  if (!defaultUserAgent) {
    defaultUserAgent = win.webContents.getUserAgent();
  }

  win.webContents.setUserAgent(settings.compatibilityMode ? getCompatibilityUserAgent() : defaultUserAgent);
}

function getCompatibilityUserAgent() {
  return COMPATIBILITY_USER_AGENTS[process.platform] || COMPATIBILITY_USER_AGENTS.win32;
}

function isChatGptOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'https:' && (hostname === 'chatgpt.com' || hostname.endsWith('.chatgpt.com'));
  } catch (error) {
    return false;
  }
}

function getPermissionOrigin(fallbackOrigin, details = {}) {
  return details.requestingUrl || details.securityOrigin || details.origin || fallbackOrigin || '';
}

function isAudioInputPermissionRequest(permission, details = {}) {
  if (permission === 'microphone') {
    return true;
  }

  if (permission !== 'media') {
    return false;
  }

  const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
  return mediaTypes.includes('audio') && !mediaTypes.includes('video');
}

function isAudioOutputPermissionRequest(permission, details = {}) {
  if (permission === 'speaker-selection') {
    return true;
  }

  const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
  return mediaTypes.includes('audioOutput') || details.deviceType === 'audiooutput' || details.deviceType === 'speaker';
}

function isClipboardWritePermission(permission) {
  return permission === 'clipboard-sanitized-write';
}

function configurePermissionHandlers(targetSession) {
  targetSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    const origin = getPermissionOrigin(requestingOrigin, details);

    if (!isChatGptOrigin(origin)) {
      return false;
    }

    if (isAudioOutputPermissionRequest(permission, details)) {
      return true;
    }

    if (isClipboardWritePermission(permission)) {
      return true;
    }

    if (isAudioInputPermissionRequest(permission, details)) {
      return settings.voiceAccess;
    }

    return false;
  });

  targetSession.setPermissionRequestHandler((_webContents, permission, callback, details = {}) => {
    const origin = getPermissionOrigin('', details);

    if (!isChatGptOrigin(origin)) {
      callback(false);
      return;
    }

    if (isAudioOutputPermissionRequest(permission, details)) {
      callback(true);
      return;
    }

    if (isClipboardWritePermission(permission)) {
      callback(true);
      return;
    }

    if (isAudioInputPermissionRequest(permission, details)) {
      callback(settings.voiceAccess);
      return;
    }

    callback(false);
  });

  if (typeof targetSession.setDevicePermissionHandler === 'function') {
    targetSession.setDevicePermissionHandler(details => {
      if (!isChatGptOrigin(getPermissionOrigin('', details))) {
        return false;
      }

      if (details.deviceType === 'audiooutput' || details.deviceType === 'speaker') {
        return true;
      }

      return settings.voiceAccess && (details.deviceType === 'media' || details.deviceType === 'audioinput');
    });
  }
}

async function updateExportPreference(key, value) {
  await updateSetting('exportPreferences', {
    ...settings.exportPreferences,
    [key]: value
  });
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
    title: 'About ChatGPT-EX',
    message: 'ChatGPT-EX',
    detail: `Extended ChatGPT Desktop Client Wrapper\nVersion ${app.getVersion()}\nhttps://chatgpt.com`,
    buttons: ['OK']
  });
}

function getDialogParent() {
  return mainWindow && mainWindow.isVisible() ? mainWindow : undefined;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function getLocalTimestampForFilename() {
  const date = new Date();
  return date.getFullYear() + '-' +
    padDatePart(date.getMonth() + 1) + '-' +
    padDatePart(date.getDate()) + 'T' +
    padDatePart(date.getHours()) + '-' +
    padDatePart(date.getMinutes()) + '-' +
    padDatePart(date.getSeconds());
}

async function clearBrowsingData() {
  const { response } = await dialog.showMessageBox(getDialogParent(), {
    type: 'warning',
    title: 'Clear Browsing Data',
    message: 'Clear ChatGPT-EX browsing data?',
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
    message: 'ChatGPT-EX browsing data has been cleared.',
    buttons: ['OK']
  });
}

function getExportDirectory() {
  return settings.exportPreferences.directory || app.getPath('documents');
}

function getExportFilename(extension) {
  return `chatgpt-export-${getLocalTimestampForFilename()}.${extension}`;
}

function getMarkdownExportPath() {
  return join(getExportDirectory(), getExportFilename('md'));
}

function getPdfExportPath() {
  return join(getExportDirectory(), getExportFilename('pdf'));
}

async function chooseExportDirectory() {
  const { canceled, filePaths } = await dialog.showOpenDialog(getDialogParent(), {
    title: 'Choose Default Export Folder',
    defaultPath: getExportDirectory(),
    properties: ['openDirectory', 'createDirectory']
  });

  if (canceled || !filePaths[0]) {
    return;
  }

  await updateExportPreference('directory', filePaths[0]);
}

function getDisplayExportDirectory() {
  return settings.exportPreferences.directory || 'Documents';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitMarkdownTableRow(row) {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  let escaped = false;

  for (const character of trimmed) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function isMarkdownTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function getValidatedConversation(conversation) {
  if (!conversation || typeof conversation !== 'object') {
    throw new Error('No conversation content was provided.');
  }

  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
        .map(message => ({
          role: typeof message.role === 'string' && message.role.trim() ? message.role.trim() : 'Message',
          text: typeof message.text === 'string' ? message.text.trim() : ''
        }))
        .filter(message => message.text)
    : [];

  if (messages.length === 0) {
    throw new Error('No conversation messages were provided.');
  }

  return {
    title: typeof conversation.title === 'string' && conversation.title.trim() ? conversation.title.trim() : 'ChatGPT conversation',
    exportedAt: typeof conversation.exportedAt === 'string' && conversation.exportedAt.trim() ? conversation.exportedAt.trim() : new Date().toISOString(),
    messages
  };
}

function renderPdfTable(lines, startIndex) {
  const header = splitMarkdownTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && /^\s*\|/.test(lines[index])) {
    rows.push(splitMarkdownTableRow(lines[index]));
    index += 1;
  }

  const headerHtml = header.map(cell => `<th>${renderInlineMarkdown(cell).replace(/&lt;br&gt;/g, '<br>')}</th>`).join('');
  const bodyHtml = rows.map(row => '<tr>' + row.map(cell => `<td>${renderInlineMarkdown(cell).replace(/&lt;br&gt;/g, '<br>')}</td>`).join('') + '</tr>').join('\n');

  return {
    html: `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`,
    nextIndex: index
  };
}

function getMarkdownListItem(line) {
  const unordered = /^(\s*)[-*+]\s+(.+)$/.exec(line);

  if (unordered) {
    return {
      ordered: false,
      indent: unordered[1].length,
      text: unordered[2]
    };
  }

  const ordered = /^(\s*)\d+[.)]\s+(.+)$/.exec(line);

  if (ordered) {
    return {
      ordered: true,
      indent: ordered[1].length,
      text: ordered[2]
    };
  }

  return null;
}

function renderPdfList(lines, startIndex) {
  const firstItem = getMarkdownListItem(lines[startIndex]);
  const tag = firstItem.ordered ? 'ol' : 'ul';
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const item = getMarkdownListItem(lines[index]);

    if (!item || item.ordered !== firstItem.ordered) {
      break;
    }

    const nestingLevel = Math.floor(item.indent / 2);
    const style = nestingLevel > 0 ? ` style="margin-left: ${nestingLevel * 18}px"` : '';
    items.push(`<li${style}>${renderInlineMarkdown(item.text)}</li>`);
    index += 1;
  }

  return {
    html: `<${tag}>${items.join('\n')}</${tag}>`,
    nextIndex: index
  };
}

function renderPdfText(text) {
  const lines = text.split('\n');
  const blocks = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push(`<p>${renderInlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
    paragraph = [];
  }

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());

    if (heading) {
      flushParagraph();
      const level = Math.min(6, heading[1].length + 2);
      blocks.push(`<h${level} class="content-heading">${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*\|/.test(line) && index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1])) {
      flushParagraph();
      const table = renderPdfTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (getMarkdownListItem(line)) {
      flushParagraph();
      const list = renderPdfList(lines, index);
      blocks.push(list.html);
      index = list.nextIndex;
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks.join('\n');
}

function renderPdfMessage(message) {
  const parts = [];
  const codeFencePattern = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeFencePattern.exec(message.text)) !== null) {
    const textBeforeCode = message.text.slice(lastIndex, match.index).trim();

    if (textBeforeCode) {
      parts.push(renderPdfText(textBeforeCode));
    }

    const language = match[1].trim();
    const code = match[2].replace(/^\n+|\n+$/g, '');
    parts.push(`
      <div class="code-block">
        ${language ? `<div class="code-language">${escapeHtml(language)}</div>` : ''}
        <pre><code>${escapeHtml(code)}</code></pre>
      </div>
    `);
    lastIndex = codeFencePattern.lastIndex;
  }

  const remainingText = message.text.slice(lastIndex).trim();

  if (remainingText) {
    parts.push(renderPdfText(remainingText));
  }

  return parts.join('\n');
}

function buildPdfHtml(conversation, options = {}) {
  const includeTimestamp = options.includeTimestamp !== false;
  const includeRoleHeadings = options.includeRoleHeadings !== false;
  const sections = conversation.messages.map(message => `
    <section class="message">
      ${includeRoleHeadings ? `<h2>${escapeHtml(message.role)}</h2>` : ''}
      ${renderPdfMessage(message)}
    </section>
  `).join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(conversation.title)}</title>
  <style>
    body {
      color: #111827;
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      margin: 24px 30px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 8px;
    }
    .meta {
      color: #6b7280;
      margin: 0 0 16px;
    }
    .message {
      border-top: 1px solid #e5e7eb;
      margin: 0;
      padding: 12px 0 0;
    }
    h2 {
      font-size: 15px;
      margin: 0 0 8px;
    }
    p {
      margin: 0 0 10px;
      white-space: normal;
    }
    ul,
    ol {
      margin: 0 0 12px 22px;
      padding: 0;
    }
    li {
      margin: 0 0 6px;
      padding-left: 2px;
    }
    a {
      color: #1d4ed8;
      text-decoration: underline;
      overflow-wrap: anywhere;
    }
    .content-heading {
      color: #111827;
      margin: 18px 0 8px;
      page-break-after: avoid;
    }
    h3.content-heading {
      font-size: 18px;
    }
    h4.content-heading {
      font-size: 16px;
    }
    h5.content-heading,
    h6.content-heading {
      font-size: 14px;
    }
    .inline-code {
      background: #f3f4f6;
      border-radius: 4px;
      color: #111827;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      padding: 1px 4px;
    }
    table {
      border-collapse: collapse;
      margin: 0 0 18px;
      page-break-inside: avoid;
      width: 100%;
    }
    th,
    td {
      border: 1px solid #d1d5db;
      padding: 7px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f3f4f6;
      font-weight: 700;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .code-block {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      color: #0f172a;
      margin: 0 0 18px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .code-language {
      background: #e2e8f0;
      border-bottom: 1px solid #cbd5e1;
      color: #334155;
      font-family: Consolas, 'Courier New', monospace;
      font-size: 11px;
      padding: 6px 10px;
    }
    .code-block pre {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .code-block code {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(conversation.title)}</h1>
  ${includeTimestamp ? `<p class="meta">Exported: ${escapeHtml(conversation.exportedAt)}</p>` : ''}
  ${sections}
</body>
</html>`;
}

async function saveExportFile(filePath, content, encoding) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, encoding);
}

async function getMarkdownSavePath() {
  const defaultPath = getMarkdownExportPath();

  if (settings.exportPreferences.saveWithoutDialog) {
    return { canceled: false, filePath: defaultPath };
  }

  return dialog.showSaveDialog(getDialogParent(), {
    title: 'Export ChatGPT Conversation',
    defaultPath,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });
}

async function getPdfSavePath() {
  const defaultPath = getPdfExportPath();

  if (settings.exportPreferences.saveWithoutDialog) {
    return { canceled: false, filePath: defaultPath };
  }

  return dialog.showSaveDialog(getDialogParent(), {
    title: 'Export ChatGPT Conversation as PDF',
    defaultPath,
    filters: [
      { name: 'PDF', extensions: ['pdf'] }
    ]
  });
}

ipcMain.handle('get-export-preferences', () => settings.exportPreferences);

ipcMain.handle('save-markdown-export', async (_event, markdown) => {
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new Error('No Markdown content was provided.');
  }

  const { canceled, filePath } = await getMarkdownSavePath();

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await saveExportFile(filePath, markdown, 'utf8');
  return { canceled: false, filePath };
});

ipcMain.handle('save-pdf-export', async (_event, conversation) => {
  const validatedConversation = getValidatedConversation(conversation);
  const { canceled, filePath } = await getPdfSavePath();

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildPdfHtml(validatedConversation, settings.exportPreferences))}`);
    const pdf = await pdfWindow.webContents.printToPDF({
      pageSize: settings.exportPreferences.pageSize,
      printBackground: true,
      margins: {
        marginType: 'custom',
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5
      }
    });

    await saveExportFile(filePath, pdf);
    return { canceled: false, filePath };
  } finally {
    pdfWindow.destroy();
  }
});

ipcMain.handle('print-conversation', async (_event, conversation) => {
  const validatedConversation = getValidatedConversation(conversation);
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildPdfHtml(validatedConversation, settings.exportPreferences))}`);
    return await new Promise((resolve, reject) => {
      printWindow.webContents.print({ printBackground: true, silent: false }, (success, failureReason) => {
        if (success) {
          resolve({ canceled: false });
          return;
        }

        if (/cancel/i.test(failureReason || '')) {
          resolve({ canceled: true });
          return;
        }

        reject(new Error(failureReason || 'Print failed.'));
      });
    });
  } finally {
    printWindow.destroy();
  }
});

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(getTrayIcon());
  tray.setToolTip('ChatGPT-EX');
  updateTrayMenu();
  tray.on('click', showMainWindow);
}

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show ChatGPT-EX', click: showMainWindow },
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
        },
        {
          label: 'Compatibility Mode',
          type: 'checkbox',
          checked: settings.compatibilityMode,
          click: () => updateSetting('compatibilityMode', !settings.compatibilityMode)
        },
        {
          label: 'Voice/Microphone Access',
          type: 'checkbox',
          checked: settings.voiceAccess,
          click: () => updateSetting('voiceAccess', !settings.voiceAccess)
        },
        { type: 'separator' },
        {
          label: 'Export Preferences',
          submenu: [
            {
              label: `Default Folder: ${getDisplayExportDirectory()}`,
              enabled: false
            },
            {
              label: 'Choose Default Folder...',
              click: chooseExportDirectory
            },
            {
              label: 'Reset to Documents',
              enabled: Boolean(settings.exportPreferences.directory),
              click: () => updateExportPreference('directory', '')
            },
            { type: 'separator' },
            {
              label: 'Include Timestamp',
              type: 'checkbox',
              checked: settings.exportPreferences.includeTimestamp,
              click: () => updateExportPreference('includeTimestamp', !settings.exportPreferences.includeTimestamp)
            },
            {
              label: 'Include Role Headings',
              type: 'checkbox',
              checked: settings.exportPreferences.includeRoleHeadings,
              click: () => updateExportPreference('includeRoleHeadings', !settings.exportPreferences.includeRoleHeadings)
            },
            {
              label: 'Save Without Dialog',
              type: 'checkbox',
              checked: settings.exportPreferences.saveWithoutDialog,
              click: () => updateExportPreference('saveWithoutDialog', !settings.exportPreferences.saveWithoutDialog)
            },
            { type: 'separator' },
            {
              label: 'PDF Page Size',
              submenu: PDF_PAGE_SIZES.map(pageSize => ({
                label: pageSize,
                type: 'radio',
                checked: settings.exportPreferences.pageSize === pageSize,
                click: () => updateExportPreference('pageSize', pageSize)
              }))
            }
          ]
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
  applyCompatibilityUserAgent(win);

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

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    await loadSettings();
    configurePermissionHandlers(session.defaultSession);
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
}
