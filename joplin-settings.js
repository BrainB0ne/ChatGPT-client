const urlInput = document.getElementById('url');
const tokenInput = document.getElementById('token');
const notebook = document.getElementById('notebook');
const status = document.getElementById('status');
const connect = document.getElementById('connect');
const config = () => ({ url: urlInput.value, token: tokenInput.value, notebookId: notebook.value });

window.joplinSettings.get().then(value => {
  urlInput.value = value.url;
  tokenInput.required = !value.tokenSaved;
  tokenInput.placeholder = value.tokenSaved ? 'Saved securely — leave blank to keep it' : 'Enter your API token';
  if (value.tokenError) status.textContent = value.tokenError;
  if (value.notebookId) notebook.add(new Option('Saved notebook (' + value.notebookId + ')', value.notebookId, true, true));
}).catch(error => { status.textContent = error.message; });

connect.addEventListener('click', async () => {
  connect.disabled = true;
  status.textContent = 'Connecting…';
  try {
    const selected = notebook.value;
    const result = await window.joplinSettings.notebooks(config());
    if (result.error) throw new Error(result.error);
    notebook.replaceChildren(new Option('Joplin default', ''));
    result.items.forEach(item => notebook.add(new Option(item.title, item.id, false, item.id === selected)));
    status.textContent = 'Connected. Choose a notebook and click Save.';
  } catch (error) { status.textContent = error.message; }
  finally { connect.disabled = false; }
});

document.getElementById('settings').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await window.joplinSettings.save(config());
    if (result.error) throw new Error(result.error);
    window.close();
  } catch (error) { status.textContent = error.message; }
});
document.getElementById('cancel').addEventListener('click', () => window.close());
