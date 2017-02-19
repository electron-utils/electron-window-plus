'use strict';

const {app} = require('electron');
const windowPlus = require('../../index');

app.on('ready', function () {
  windowPlus.restore(`${__dirname}/index.html`, {
    center: true,
    width: 400,
    height: 300,
  });
});
