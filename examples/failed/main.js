'use strict';

const {app, BrowserWindow} = require('electron');

app.on('ready', function () {
  let win = new BrowserWindow({
    center: true,
    width: 400,
    height: 300,
  });
  win.loadURL(`file://${__dirname}/../../lib/failed.html`);
});
