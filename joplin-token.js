// safeStorage is supplied by the main process, after Electron is ready.
function createJoplinTokenStore(safeStorage) {
  let encryptedToken = '';

  function requireSecureStorage() {
    if (!safeStorage.isEncryptionAvailable() ||
      (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
      throw new Error('Secure credential storage is unavailable. Enable your OS keyring/credential service, then enter the Joplin token again.');
    }
  }

  return {
    read(value = {}) {
      encryptedToken = typeof value.encryptedToken === 'string' ? value.encryptedToken : '';
      if (!encryptedToken) return typeof value.token === 'string' ? value.token : '';
      requireSecureStorage();
      try {
        return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'));
      } catch {
        throw new Error('The saved Joplin token could not be decrypted. Re-enter it in Settings > Joplin.');
      }
    },
    serialize(config) {
      // Preserve an unreadable encrypted token when saving unrelated preferences.
      const ciphertext = config.token
        ? (() => { requireSecureStorage(); return safeStorage.encryptString(config.token).toString('base64'); })()
        : encryptedToken;
      return { url: config.url, notebookId: config.notebookId, encryptedToken: ciphertext };
    },
    commit(value) {
      encryptedToken = value.encryptedToken;
    }
  };
}

module.exports = { createJoplinTokenStore };
