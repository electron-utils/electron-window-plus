'use strict';

const {app, BrowserWindow, ipcMain} = require('electron');
const windowPlus = require('../../index');

app.on('ready', function () {
  windowPlus.restore();

  if ( windowPlus.empty ) {
    let win = new BrowserWindow({
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    });
    win.loadURL('file://' + __dirname + '/index.html');

    let win2 = new BrowserWindow({
      x: 510,
      y: 100,
      width: 400,
      height: 300,
    });
    win2.loadURL('file://' + __dirname + '/index-02.html');

    windowPlus.manage(win);
    windowPlus.manage(win2);
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
