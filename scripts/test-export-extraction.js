const { app, BrowserWindow } = require('electron');
const { readFileSync } = require('fs');
const { join } = require('path');
const { runInNewContext } = require('vm');

const mainSource = readFileSync(join(__dirname, '..', 'main.js'), 'utf8');
const scriptSource = mainSource.match(/const ACTION_BUTTONS_SCRIPT = `([\s\S]*?)`;\r?\n\r?\nfunction getActionButtonsScript/);

if (!scriptSource) {
  throw new Error('Export script not found.');
}

const pdfRendererSource = mainSource.match(/function renderPdfMessage\(message\) \{[\s\S]*?\n\}/)?.[0];

if (!pdfRendererSource) {
  throw new Error('PDF/HTML code block renderer not found.');
}

const renderPdfMessage = runInNewContext('(' + pdfRendererSource + ')', {
  renderPdfText: text => text,
  escapeHtml: value => String(value)
});

const actionScript = runInNewContext('`' + scriptSource[1] + '`')
  .replace(/'__(?:MARKDOWN|HTML|PDF|PRINT|RELOAD)_ICON__'/g, JSON.stringify('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
const tripleTicks = String.fromCharCode(96).repeat(3);

const fixtures = [
  {
    name: 'turn IDs with role attributes',
    html: `<main>
      <article data-turn-id="first" data-turn-role="user"><div data-testid="user-message">Question</div></article>
      <article data-turn-id="second" data-turn-role="assistant"><div data-message-id="empty"></div><div class="markdown"><p>Answer</p><pre><code class="language-js">const a = 1;\nconst b = 2;</code></pre></div></article>
    </main>`,
    expected: ['Question', 'Answer', 'const a = 1;\nconst b = 2;'],
    expectedCodeFence: '```js\nconst a = 1;\nconst b = 2;\n```'
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
  },
  {
    name: 'multiline code without a pre wrapper',
    html: `<main>
      <article data-turn-role="user" data-turn-id="prompt"><div data-user-message-bubble>Show code</div></article>
      <article data-turn-role="assistant" data-turn-id="reply"><div class="markdown"><p>Inline <code>small</code> example.</p><div class="code-block"><code class="language-js"><span class="line">const first = 1;</span><span class="line">const second = 2;</span></code></div></div></article>
    </main>`,
    expected: ['Show code', 'Inline `small` example.', 'const first = 1;', 'const second = 2;'],
    expectedCodeFence: '```js\nconst first = 1;\nconst second = 2;\n```'
  },
  {
    name: 'code containing Markdown fences',
    html: `<main>
      <article data-turn-id="prompt" data-turn-role="user">Show literal backticks</article>
      <article data-turn-id="reply" data-turn-role="assistant"><div class="markdown"><pre><code class="language-js">const fence = "${tripleTicks}";\nconsole.log(fence);</code></pre></div></article>
    </main>`,
    expected: ['Show literal backticks', `const fence = "${tripleTicks}";\nconsole.log(fence);`],
    expectedCodeFence: `${String.fromCharCode(96).repeat(4)}js\nconst fence = "${tripleTicks}";\nconsole.log(fence);\n${String.fromCharCode(96).repeat(4)}`
  }
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  win.webContents.on('console-message', event => {
    if (event.level === 'error') console.error(event.message);
  });

  try {
    for (const fixture of fixtures) {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fixture.html)}`);
      await win.webContents.executeJavaScript(`
        const attachShadow = Element.prototype.attachShadow;
        window.__selectionShadows = new WeakMap();
        window.__selectionInputs = () => Array.from(document.querySelectorAll('[data-chatgpt-ex-selection-control]'))
          .flatMap(host => Array.from(window.__selectionShadows.get(host)?.querySelectorAll('input') || []));
        Element.prototype.attachShadow = function(options) {
          const shadow = attachShadow.call(this, options);
          if (this.id === 'chatgpt-ex-actions-host') window.__actionShadow = shadow;
          if (this.hasAttribute('data-chatgpt-ex-selection-control')) window.__selectionShadows.set(this, shadow);
          return shadow;
        };
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

          if (fixture.expectedCodeFence && !text.includes(fixture.expectedCodeFence)) {
            throw new Error(`${fixture.name}: ${action} did not preserve a fenced code block.`);
          }

          if (fixture.expectedCodeFence && action !== 'markdown' &&
            !renderPdfMessage(exported.messages[1]).includes('<pre><code>')) {
            throw new Error(`${fixture.name}: ${action} did not render the fenced code block.`);
          }

          const roles = fixture.roles || ['User', 'Assistant'];

          if (typeof exported !== 'string' &&
            (exported.messages.length !== roles.length || exported.messages.some((message, index) => message.role !== roles[index]))) {
            throw new Error(`${fixture.name}: ${action} did not preserve message roles.`);
          }
        }
        if (fixture.expectedAfterSwitch && round === 0) {
          await win.webContents.executeJavaScript(`
            window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: 'select-messages' }));
            const checkbox = window.__selectionInputs()[0];
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
          `);
        }
      }

      if (fixture.name === 'turn IDs with role attributes') {
        console.log('Checking message selection and pair defaults.');
        await win.webContents.executeJavaScript(`
          window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: 'select-messages' }));
          const user = window.__selectionInputs().find(input => input.getAttribute('aria-label') === 'Select User message 1');
          user.checked = true;
          user.dispatchEvent(new Event('change'));
          if (window.__selectionInputs().filter(input => input.checked).length !== 2) {
            throw new Error('Selecting a user did not select its assistant reply.');
          }
          user.checked = false;
          user.dispatchEvent(new Event('change'));
          // Keep just the answer selected, and replace it to simulate a React rerender.
          const answer = document.querySelector('[data-turn-id="second"]');
          answer.replaceWith(answer.cloneNode(true));
        `);
        await win.webContents.executeJavaScript(`
          (async () => {
            const control = document.querySelector('[data-chatgpt-ex-selection-control]');
            const text = document.querySelector('[data-testid="user-message"]');
            const textRange = document.createRange();
            textRange.selectNodeContents(Array.from(text.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()));
            if (control.getBoundingClientRect().bottom > textRange.getBoundingClientRect().top) {
              throw new Error('Selection control overlaps message content.');
            }
            for (const theme of ['light', 'dark']) {
              document.documentElement.style.colorScheme = theme;
              text.style.cssText = 'width:280px;margin-left:160px;color:' + (theme === 'dark' ? '#eee' : '#111');
              if (control.parentElement !== text) throw new Error('Selector attached to full-width turn instead of bubble.');
              const label = window.__selectionShadows.get(control).querySelector('label');
              const bubbleBounds = text.getBoundingClientRect();
              const labelBounds = label.getBoundingClientRect();
              if (labelBounds.left < bubbleBounds.left || labelBounds.right > bubbleBounds.right + 1) {
                throw new Error(theme + ': selector is outside the message content column.');
              }
            }
            document.body.style.minHeight = '2000px';
            const before = control.getBoundingClientRect().top;
            window.scrollTo(0, 100);
            await new Promise(resolve => setTimeout(resolve, 600));
            if (!control.isConnected || Math.abs(control.getBoundingClientRect().top - before + window.scrollY) > 1) {
              throw new Error('Selection control does not scroll naturally with the message.');
            }
            window.scrollTo(0, 0);
          })()
        `);

        for (const action of ['markdown', 'html', 'pdf', 'print']) {
          const result = await win.webContents.executeJavaScript(`
            new Promise(resolve => {
              const count = window.__exports.length;
              window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: '${action}' }));
              const check = () => window.__exports.length > count
                ? resolve(window.__exports[count]) : setTimeout(check, 10);
              check();
              setTimeout(() => resolve(null), 2000);
            })
          `);
          const text = typeof result === 'string' ? result : result?.messages.map(message => message.text).join('\n');
          if (!text?.includes('Answer') || text.includes('Question') || text.includes('Select Assistant')) {
            throw new Error(`${action}: selection did not survive rerender or omitted filtering.`);
          }
        }

        await win.webContents.executeJavaScript(`
          const buttons = Array.from(window.__actionShadow.querySelectorAll('button'));
          buttons.find(button => button.textContent === 'Clear').click();
          window.__alert = '';
          window.alert = message => { window.__alert = message; };
          window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: 'markdown' }));
        `);
        await new Promise(resolve => setTimeout(resolve, 100));
        const alert = await win.webContents.executeJavaScript('window.__alert');
        if (!alert.includes('Select at least one')) throw new Error('Empty selection exported the entire chat.');

        await win.webContents.executeJavaScript(`
          const doneButtons = Array.from(window.__actionShadow.querySelectorAll('button'));
          doneButtons.find(button => button.textContent === 'Select All').click();
          if (window.__selectionInputs().filter(input => input.checked).length !== 2) throw new Error('Select All failed.');
          const assistant = window.__selectionInputs().find(input => input.getAttribute('aria-label') === 'Select Assistant message 2');
          assistant.checked = false;
          assistant.dispatchEvent(new Event('change'));
          doneButtons.find(button => button.textContent === 'Done').click();
          if (window.__selectionInputs().length) throw new Error('Done did not hide checkboxes.');
        `);
        const promptOnly = await win.webContents.executeJavaScript(`
          new Promise(resolve => {
            const count = window.__exports.length;
            window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: 'markdown' }));
            const check = () => window.__exports.length > count
              ? resolve(window.__exports[count]) : setTimeout(check, 10);
            check();
            setTimeout(() => resolve(null), 2000);
          })
        `);
        if (!promptOnly?.includes('Question') || promptOnly.includes('Answer')) {
          throw new Error('Done did not retain a prompt-only selection.');
        }
        await win.webContents.executeJavaScript(`
          Array.from(window.__actionShadow.querySelectorAll('button')).find(button => button.textContent === 'Cancel').click();
        `);
        const restored = await win.webContents.executeJavaScript(`
          new Promise(resolve => {
            const count = window.__exports.length;
            window.dispatchEvent(new CustomEvent('chatgpt-ex-action', { detail: 'markdown' }));
            const check = () => window.__exports.length > count
              ? resolve(window.__exports[count]) : setTimeout(check, 10);
            check();
            setTimeout(() => resolve(null), 2000);
          })
        `);
        if (!restored?.includes('Question') || !restored.includes('Answer')) {
          throw new Error('Cancel did not restore full conversation exports.');
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
