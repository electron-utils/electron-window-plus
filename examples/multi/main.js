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
    windowPlus.loadURL(win, `file://${__dirname}/index.html`);

    let win2 = new BrowserWindow({
      x: 410,
      y: 100,
      width: 300,
      height: 300,
    });
    windowPlus.manage(win2);
    windowPlus.loadURL(win2, `file://${__dirname}/sub.html`);

    let win3 = new BrowserWindow({
      x: 720,
      y: 100,
      width: 300,
      height: 300,
    });
    windowPlus.manage(win3);
    windowPlus.loadURL(win3, 'http://electron.atom.io');
  }

  //
  windowPlus.main.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();

    let newWin = new BrowserWindow({
      width: 400,
      height: 300,
    });
    newWin.loadURL(url);
    windowPlus.manage(newWin);
    windowPlus.adjustToMain(newWin);
  });
});

ipcMain.on('new-window', (event, header, content) => {
  let win = new BrowserWindow({
    width: 400,
    height: 300,
  });

  windowPlus.manage(win);
  windowPlus.adjustToMain(win);
  windowPlus.loadURL(win, `file://${__dirname}/sub.html`, {
    header: header,
    content: content
  });
});

// https://github.com/electron/electron#documentation
