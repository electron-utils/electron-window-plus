'use strict';

const {app, BrowserWindow, ipcMain} = require('electron');
const windowPlus = require('../../index');

app.on('ready', function () {
  if ( !windowPlus.restore() ) {
    let win = new BrowserWindow({
      x: 100,
      y: 100,
      width: 300,
      height: 300,
    });
    windowPlus.manage(win);
    win.loadURL('file://' + __dirname + '/index.html');

    let win2 = new BrowserWindow({
      x: 410,
      y: 100,
      width: 300,
      height: 300,
    });
    windowPlus.manage(win2);
    win2.loadURL('file://' + __dirname + '/index-02.html');

    let win3 = new BrowserWindow({
      x: 720,
      y: 100,
      width: 300,
      height: 300,
    });
    windowPlus.manage(win3);
    windowPlus.loadURL(win3, 'http://electron.atom.io');
  }
});

ipcMain.on('new-window', () => {
  let win = new BrowserWindow({
    width: 400,
    height: 300,
  });
  win.loadURL('file://' + __dirname + '/index-02.html');

  windowPlus.adjustToMain(win);
  windowPlus.manage(win);
});
