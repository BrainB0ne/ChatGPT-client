const { app, BrowserWindow } = require('electron');
const { readFileSync } = require('fs');
const { join } = require('path');
const { runInNewContext } = require('vm');

const mainSource = readFileSync(join(__dirname, '..', 'main.js'), 'utf8');
const scriptSource = mainSource.match(/const ACTION_BUTTONS_SCRIPT = `([\s\S]*?)`;\r?\n\r?\nfunction getActionButtonsScript/);

if (!scriptSource) {
  throw new Error('Export script not found.');
}

const actionScript = runInNewContext('`' + scriptSource[1] + '`')
  .replace(/'__(?:MARKDOWN|HTML|PDF|PRINT|RELOAD)_ICON__'/g, JSON.stringify('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));

const fixtures = [
  {
    name: 'turn IDs with role attributes',
    html: `<main>
      <article data-turn-id="first" data-turn-role="user"><div data-testid="user-message">Question</div></article>
      <article data-turn-id="second" data-turn-role="assistant"><div data-message-id="empty"></div><div class="markdown"><p>Answer</p><pre><code class="language-js">const a = 1;\nconst b = 2;</code></pre></div></article>
    </main>`,
    expected: ['Question', 'Answer', 'const a = 1;\nconst b = 2;']
  },
  {
    name: 'message articles without legacy turn selectors',
    html: `<main>
      <article><div data-testid="user-message">New question</div></article>
      <article><div data-testid="assistant-message"><p>New answer</p></div></article>
    </main>`,
    expected: ['New question', 'New answer']
  },
  {
    name: 'legacy author-role wrappers',
    html: `<main>
      <div data-message-author-role="user"><div>Earlier question</div></div>
      <div data-message-author-role="assistant"><div class="markdown"><p>Earlier answer</p></div></div>
    </main>`,
    expected: ['Earlier question', 'Earlier answer']
  },
  {
    name: 'user bubbles and assistant prose without turn markers',
    html: `<main>
      <div><div><div data-user-message-bubble><p>Bubble question</p></div></div></div>
      <div><h5>ChatGPT said:</h5><span class="sr-only">Screen reader label</span><div class="prose"><p>Prose answer</p><p>Next paragraph</p><pre><code>first line\nsecond line</code></pre></div></div>
      <form><div class="prose" contenteditable="true">Composer draft</div></form>
    </main>`,
    expected: ['Bubble question', 'Prose answer\n\nNext paragraph', 'first line\nsecond line'],
    excluded: ['ChatGPT said:', 'Screen reader label', 'Composer draft']
  },
  {
    name: 'unmarked assistant siblings following user bubbles',
    html: `<main><section>
      <div><div><div data-user-message-bubble>First prompt</div><div><button>Copy</button></div></div></div>
      <div><div><p>First reply</p></div></div>
      <div><div data-user-message-bubble>Second prompt</div></div>
      <div><p>Second reply</p></div>
    </section></main>`,
    expected: ['First prompt', 'First reply', 'Second prompt', 'Second reply'],
    roles: ['User', 'Assistant', 'User', 'Assistant']
  },
  {
    name: 'switching chats without a page reload',
    html: `<main id="previous-chat">
      <article data-turn-id="old-user" data-turn-role="user"><div data-user-message-bubble>Previous prompt</div></article>
      <article data-turn-id="old-answer" data-turn-role="assistant"><div class="markdown">Previous reply</div></article>
    </main><main id="current-chat" style="display: none">
      <article data-turn-id="new-user" data-turn-role="user"><div data-user-message-bubble>Current prompt</div></article>
      <article data-turn-id="new-answer" data-turn-role="assistant"><div data-message-id="old-content" hidden>Previous reply</div><div class="markdown">Current reply</div></article>
    </main>`,
    expected: ['Previous prompt', 'Previous reply'],
    expectedAfterSwitch: ['Current prompt', 'Current reply'],
    excludedAfterSwitch: ['Previous prompt', 'Previous reply']
  },
  {
    name: 'switching chat sections inside the same main element',
    html: `<main><section id="previous-chat">
      <div data-user-message-bubble>Old section prompt</div><div class="prose">Old section reply</div>
    </section><section id="current-chat" style="display: none">
      <div data-user-message-bubble>New section prompt</div><div class="prose">New section reply</div>
    </section></main>`,
    expected: ['Old section prompt', 'Old section reply'],
    expectedAfterSwitch: ['New section prompt', 'New section reply'],
    excludedAfterSwitch: ['Old section prompt', 'Old section reply']
  }
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });

  try {
    for (const fixture of fixtures) {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fixture.html)}`);
      await win.webContents.executeJavaScript(`
        window.chatgptDesktop = {
          getExportPreferences: async () => ({}),
          getWindowTitle: async () => 'Test chat',
          saveMarkdown: async value => { window.__exports.push(value); return { canceled: false }; },
          saveHtml: async value => { window.__exports.push(value); return { canceled: false }; },
          savePdf: async value => { window.__exports.push(value); return { canceled: false }; },
          printConversation: async value => { window.__exports.push(value); return { canceled: false }; }
        };
        window.__exports = [];
      `);
      await win.webContents.executeJavaScript(actionScript);

      for (const [round, expected] of [fixture.expected, fixture.expectedAfterSwitch].filter(Boolean).entries()) {
        if (round === 1) {
          await win.webContents.executeJavaScript(`
            document.getElementById('previous-chat').style.display = 'none';
            document.getElementById('current-chat').style.display = '';
          `);
        }

        for (const action of ['markdown', 'html', 'pdf', 'print']) {
          const exported = await win.webContents.executeJavaScript(`
            new Promise(resolve => {
              const expectedCount = window.__exports.length + 1;
              window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: '${action}' }));
              const check = () => window.__exports.length === expectedCount
                ? resolve(window.__exports[expectedCount - 1])
                : setTimeout(check, 10);
              check();
              setTimeout(() => resolve(null), 2000);
            })
          `);

          const text = typeof exported === 'string'
            ? exported
            : exported?.messages.map(message => message.text).join('\n');

          if (!text || !expected.every(fragment => text.includes(fragment))) {
            throw new Error(`${fixture.name}: ${action} omitted conversation content.`);
          }

          const excluded = round === 1 ? fixture.excludedAfterSwitch : fixture.excluded;

          if (excluded?.some(fragment => text.includes(fragment))) {
            throw new Error(`${fixture.name}: ${action} included non-message UI text.`);
          }

          const roles = fixture.roles || ['User', 'Assistant'];

          if (typeof exported !== 'string' &&
            (exported.messages.length !== roles.length || exported.messages.some((message, index) => message.role !== roles[index]))) {
            throw new Error(`${fixture.name}: ${action} did not preserve message roles.`);
          }
        }
      }
    }

    console.log('Export extraction fixtures passed for Markdown, HTML, PDF, and print.');
  } finally {
    win.destroy();
    app.quit();
  }
}).catch(error => {
  console.error(error);
  app.exit(1);
});
