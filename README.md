# electron-window-plus

[![Linux Build Status](https://travis-ci.org/electron-utils/electron-window-plus.svg?branch=master)](https://travis-ci.org/electron-utils/electron-window-plus)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/7cf5xyawomjy3na2?svg=true)](https://ci.appveyor.com/project/jwu/electron-window-plus)
[![Dependency Status](https://david-dm.org/electron-utils/electron-window-plus.svg)](https://david-dm.org/electron-utils/electron-window-plus)
[![devDependency Status](https://david-dm.org/electron-utils/electron-window-plus/dev-status.svg)](https://david-dm.org/electron-utils/electron-window-plus#info=devDependencies)

Save and restore window states.

## Why this module?

There are several great module such as [electron-window-state](https://github.com/mawie81/electron-window-state), [electron-window-manager](https://github.com/TamkeenLMS/electron-window-manager)
that doing the same thing. What is the advantage of this module compare to them?

  - Support save and restore multiple windows.
  - Do not introduce new Window class for management.

## Install

```bash
npm install --save electron-window-plus
```

## Run Examples:

```bash
npm start examples/${name}
```

## Usage

```javascript
const {app, BrowserWindow} = require('electron');
const windowPlus = require('electron-window-plus');

app.on('ready', function () {
  if ( !windowPlus.restore() ) {
    let win = new BrowserWindow({
      width: 300,
      height: 300,
    });

    windowPlus.manage(win);
    windowPlus.loadURL(win, `file://${__dirname}/index.html`);
  }
});
```

## API Reference

### Methods

### windowPlus.restore ([url, opts])

  - `url` string
  - `opts` options

### windowPlus.manage (win)

  - `win` BrowserWindow

### windowPlus.unmanage (win)

  - `win` BrowserWindow|number

### windowPlus.update (win, info)

  - `win` BrowserWindow|number
  - `info` object

### windowPlus.save ()

### windowPlus.loadURL (win, url, argv)

  - `win` BrowserWindow
  - `string` url
  - `object` argv

### windowPlus.adjust (win, x, y, w, h)
  - `win` BrowserWindow
  - `x` number
  - `y` number
  - `w` number
  - `h` number

Try to adjust the window to fit the position and size we give

### windowPlus.adjustToMain (win)

  - `win` BrowserWindow

Adjust window position to make it open in the same display screen as main window

### windowPlus.on (eventName, listener)

  - `eventName` string
  - `listener` function

Adds an event listener function.

### windowPlus.off (eventName, listener)

  - `eventName` string
  - `listener` function

Removes an event listener function.

### windowPlus.once (eventName, listener)

  - `eventName` string
  - `listener` function

Adds a one time event listener function.

### Properties

### windowPlus.main (BrowserWindow)

The main window.

## License

MIT © 2017 Johnny Wu
