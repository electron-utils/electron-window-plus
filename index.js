'use strict';

const platform = require('electron-platform');
const pkgJson = require('./package.json');

let windowPlus;
let name = `__electron_window_plus__`;
let msg = `Failed to require ${pkgJson.name}@${pkgJson.version}:
  A different version of ${pkgJson.name} already running in the process, we will redirect to it.
  Please make sure your dependencies use the same version of ${pkgJson.name}.`;

if ( platform.isMainProcess ) {
  if (global[name]) {
    console.warn(msg);
    windowPlus = global[name];
  } else {
    windowPlus = global[name] = require('./lib/main');
  }
} else {
  // windowPlus = require('./lib/renderer/index');
}

// ==========================
// exports
// ==========================

module.exports = windowPlus;
