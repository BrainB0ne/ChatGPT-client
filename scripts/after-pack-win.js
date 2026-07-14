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
  const productName = context.packager.appInfo.productName;
  const executableName = `${context.packager.appInfo.productFilename}.exe`;

  execFileSync(rcedit.x64, [
    exePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'InternalName', context.packager.appInfo.productFilename,
    '--set-version-string', 'OriginalFilename', executableName
  ], { stdio: 'inherit' });
};
