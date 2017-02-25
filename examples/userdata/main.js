'use strict';

const {app, ipcMain} = require('electron');
const windowPlus = require('../../index');

app.on('ready', function () {
  windowPlus.restore(`${__dirname}/index.html`, {
    center: true,
    width: 400,
    height: 300,
  });

  console.log('userdata: ', windowPlus.getUserData(windowPlus.main));
});

ipcMain.on('submit-user-data', (event, user) => {
  windowPlus.updateUserData(windowPlus.main, {
    name: user,
  });
  console.log('userdata updated!');
});