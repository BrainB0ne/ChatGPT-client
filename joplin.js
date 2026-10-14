const DEFAULT_JOPLIN_SETTINGS = { url: 'http://127.0.0.1:41184', token: '', notebookId: '' };

function normalizeJoplinSettings(value = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_JOPLIN_SETTINGS).map(([key, fallback]) =>
    [key, typeof value?.[key] === 'string' ? value[key].trim() : fallback]));
}

function validateJoplinSettings(value) {
  const config = normalizeJoplinSettings(value);
  const url = new URL(config.url);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use a local HTTP service URL, such as http://127.0.0.1:41184.');
  }
  if (!config.token) throw new Error('Enter the Joplin Web Clipper API token in Settings > Joplin.');
  return config;
}

async function joplinRequest(value, path, options = {}) {
  const config = validateJoplinSettings(value);
  const url = new URL(path, config.url);
  url.searchParams.set('token', config.token);
  let response;
  try {
    response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error('Cannot reach Joplin. Open Joplin and enable its Web Clipper service, then check the service URL.');
  }
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? 'Joplin rejected the API token. Check Settings > Joplin.'
      : `Joplin request failed (HTTP ${response.status}). Check the destination notebook and service settings.`);
  }
  return response.json();
}

async function getJoplinNotebooks(config) {
  const items = [];
  for (let page = 1; ; page++) {
    const result = await joplinRequest(config, `/folders?fields=id,title&limit=100&page=${page}`);
    items.push(...result.items);
    if (!result.has_more) return items;
  }
}

async function createJoplinNote(config, title, markdown) {
  const validated = validateJoplinSettings(config);
  const body = { title, body: markdown };
  if (validated.notebookId) body.parent_id = validated.notebookId;
  return joplinRequest(validated, '/notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

module.exports = { DEFAULT_JOPLIN_SETTINGS, normalizeJoplinSettings, validateJoplinSettings, getJoplinNotebooks, createJoplinNote };
