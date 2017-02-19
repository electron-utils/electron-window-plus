'use strict';

const platform = require('electron-platform');

let windowPlus;

if ( platform.isMainProcess ) {
  windowPlus = require('./lib/main');
} else {
  // windowPlus = require('./lib/renderer/index');
}

// ==========================
// exports
// ==========================

module.exports = windowPlus;
