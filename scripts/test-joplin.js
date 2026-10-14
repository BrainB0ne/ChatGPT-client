const assert = require('node:assert/strict');
const http = require('node:http');
const { createJoplinNote, getJoplinNotebooks, validateJoplinSettings } = require('../joplin');
const { createJoplinTokenStore } = require('../joplin-token');

async function main() {
  const secureStorage = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'test-keyring',
    encryptString: token => Buffer.from('encrypted:' + token.split('').reverse().join('')),
    decryptString: buffer => {
      if (!buffer.toString().startsWith('encrypted:')) throw new Error('Bad ciphertext');
      return buffer.toString().slice(10).split('').reverse().join('');
    }
  };
  const store = createJoplinTokenStore(secureStorage);
  const migratedToken = store.read({ token: 'secret-token' });
  const stored = store.serialize({ url: 'http://localhost:41184', notebookId: '', token: migratedToken });
  assert.equal('token' in stored, false);
  assert.equal(JSON.stringify(stored).includes('secret-token'), false);
  store.commit(stored);
  assert.equal(createJoplinTokenStore(secureStorage).read(stored), 'secret-token');
  const unavailable = createJoplinTokenStore({ ...secureStorage, isEncryptionAvailable: () => false });
  assert.throws(() => unavailable.read(stored), /unavailable/);
  assert.deepEqual(unavailable.serialize({ url: stored.url, notebookId: '', token: '' }), stored);
  assert.throws(() => unavailable.serialize({ token: 'new-token' }), /unavailable/);
  const corrupt = createJoplinTokenStore(secureStorage);
  const corruptStored = { ...stored, encryptedToken: Buffer.from('corrupt').toString('base64') };
  assert.throws(() => corrupt.read(corruptStored), /could not be decrypted/);
  assert.deepEqual(corrupt.serialize({ url: stored.url, notebookId: '', token: '' }), corruptStored);
  if (process.platform === 'linux') {
    const insecure = createJoplinTokenStore({ ...secureStorage, getSelectedStorageBackend: () => 'basic_text' });
    assert.throws(() => insecure.serialize({ token: 'token' }), /unavailable/);
  }
  let created;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Content-Type', 'application/json');
    if (url.searchParams.get('token') !== 'test-token') {
      response.writeHead(403);
      response.end('{}');
      return;
    }
    if (url.pathname === '/folders') {
      const page = Number(url.searchParams.get('page'));
      response.end(JSON.stringify({ items: [{ id: 'folder-' + page, title: 'Notebook ' + page }], has_more: page === 1 }));
    } else if (url.pathname === '/notes') {
      let body = '';
      for await (const chunk of request) body += chunk;
      created = JSON.parse(body);
      response.end(JSON.stringify({ id: 'new-note' }));
    } else { response.writeHead(404); response.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = { url: `http://127.0.0.1:${server.address().port}`, token: 'test-token', notebookId: 'folder-2' };
  try {
    assert.throws(() => validateJoplinSettings({ ...config, url: 'https://example.com' }));
    assert.throws(() => validateJoplinSettings({ ...config, token: '' }));
    assert.equal((await getJoplinNotebooks(config)).length, 2);
    assert.equal((await createJoplinNote(config, 'Chat subject', '# Chat\n\nSelected answer')).id, 'new-note');
    assert.deepEqual(created, { title: 'Chat subject', body: '# Chat\n\nSelected answer', parent_id: 'folder-2' });
    await createJoplinNote({ ...config, notebookId: '' }, 'Default notebook', 'Text');
    assert.equal('parent_id' in created, false);
    await assert.rejects(getJoplinNotebooks({ ...config, token: 'wrong' }), /rejected the API token/);
    console.log('Joplin token-storage and mock-service tests passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
