/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { execFileSync } = require('node:child_process');
const { join, resolve } = require('node:path');
const { getRceditBundle } = require('app-builder-lib/out/toolsets/windows');

module.exports = async context => {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const rcedit = await getRceditBundle('1.1.0');
  const exePath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = resolve('build/icons/icon.ico');

  execFileSync(rcedit.x64, [exePath, '--set-icon', iconPath], { stdio: 'inherit' });
};
