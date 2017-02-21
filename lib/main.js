'use strict';

if ( global.__electron_window_plus__ ) {
  const pkgJson = require('../package.json');
  console.warn(`A different version of electron-window-plus already running in the process: ${pkgJson.version}, redirect to it. Please make sure your dependencies use the same version of electron-window-plus.`);
  module.exports = global.__electron_window_plus__;

  return;
}

const electron = require('electron');
const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const url_ = require('url');
const EventEmitter = require('events');
const protocols = require('electron-protocols');
const profile = require('electron-profile');
const uuidV4 = require('uuid/v4');

const profileVersion = '1.0.0';
const emitter = new EventEmitter();

let _winInfos = [];
let _mainwin = null;
let _windowsProfile = null;

// ==========================
// exports
// ==========================

/**
 * @module windowPlus
 */
let windowPlus = {};
module.exports = windowPlus;
global.__electron_window_plus__ = windowPlus;

/**
 * @method restore
 * @param [url] {string}
 * @param [opts] {object}
 */
windowPlus.restore = function (url, opts) {
  _windowsProfile = profile.load('profile://local/electron-window-plus.state.json', {
    version: profileVersion,
    windows: [],
  });

  let firstWin;

  // failed to load the profile, create a default window instead
  if ( _windowsProfile ) {
    // reset layout if the version is not the same
    if ( _windowsProfile.data.version !== profileVersion ) {
      _windowsProfile.reset({
        version: profileVersion,
        windows: [],
      });
    }

    for ( let i = 0; i < _windowsProfile.data.windows.length; ++i ) {
      let state = _windowsProfile.data.windows[i];
      let win;

      if ( state.main ) {
        // NOTE: It is possible we change default options during development, so event we restore
        //       a window, we should always apply default options for the main window.

        // clone the opts
        let opts2 = Object.assign({}, opts);
        opts2.show = false;

        win = new BrowserWindow(opts2);
        _mainwin = win;
      } else {
        win = new BrowserWindow({
          show: false
        });
      }

      if ( !firstWin ) {
        firstWin = win;
      }

      // manage the win
      windowPlus.manage(win);
      if ( state.uuid ) {
        windowPlus.update(win, {
          uuid: state.uuid
        });
      }

      // TODO: move to dockable
      // // if this is a sub panel window
      // if ( !state.main && state.panels && state.panels.length ) {
      //   win._browserWin.setMenuBarVisibility(false);
      // }

      windowPlus.adjust(
        win, state.x, state.y, state.width, state.height
      );
      win.show();
      windowPlus.loadURL(win, state.url, state.argv);
    }
  }

  // check if we have main window
  if ( !_mainwin ) {
    // try to set main win to the first win.
    _mainwin = firstWin;

    // if we still not found the main window, but we do provide url
    if ( !_mainwin && url ) {
      _mainwin = new BrowserWindow(opts);
      windowPlus.manage(_mainwin);

      _mainwin.show();
      windowPlus.loadURL(_mainwin, url);
    }
  }

  // NOTE: restored when we have one more window and also have a window set as main.
  if ( _mainwin ) {
    _mainwin.focus();
  }

  // return if we restore/create at least one window
  return _winInfos.length !== 0;
};

/**
 * @method manage
 * @param {BrowserWindow} win
 */
windowPlus.manage = function (win) {
  let info = _getWinInfo(win.id);
  if ( info ) {
    console.warn( `Failed to add window ${win.id}: already added.` );
    return;
  }

  if ( !_mainwin ) {
    _mainwin = win;
  }

  let winID = win.id;

  info = {
    id: winID,
    uuid: uuidV4(),
  };
  _winInfos.push(info);

  win.on('close', () => {
    // NOTE: I cannot put these in 'closed' event. In Windows, the getBounds will return
    //       zero width and height in 'closed' event
    _saveWindowStates();
  });

  win.on('closed', () => {
    // NOTE: can not use win.id here
    windowPlus.unmanage(winID);

    if ( _mainwin === win ) {
      _mainwin = null;
      app.quit();
    }
  });
};

/**
 * @method unmanage
 * @param {BrowserWindow|number} win
 */
windowPlus.unmanage = function (win) {
  let winID = -1;
  let idx = -1;

  if ( typeof win === 'number' ) {
    winID = win;
  } else if ( win instanceof BrowserWindow ) {
    winID = win.id;
  }

  for ( let i = 0; i < _winInfos.length; ++i ) {
    let winInfo = _winInfos[i];
    if ( winInfo.id === winID ) {
      idx = i;
      break;
    }
  }

  if ( idx === -1 ) {
    console.warn( `Failed to remove window ${winID}: can not find it.` );
    return false;
  }

  _winInfos.splice(idx,1);
  return true;
};

/**
 * @method update
 */
windowPlus.update = function (win, info) {
  let winID = -1;

  if ( typeof win === 'number' ) {
    winID = win;
  } else if ( win instanceof BrowserWindow ) {
    winID = win.id;
  }

  //
  let src = _getWinInfo(winID);
  if ( !src ) {
    console.warn( `Failed to update window ${win.id}: info not found.` );
    return;
  }

  for ( let name in info ) {
    src[name] = info[name];
  }
};

/**
 * @method save
 */
windowPlus.save = function () {
  _saveWindowStates();
};

/**
 * @method loadURL
 * @param {BrowserWindow} win
 * @param {string} url
 * @param {object} argv
 *
 * Load page by url, and send `argv` in query property of the url.
 */
windowPlus.loadURL = function (win, url, argv) {
  let convertedUrl = protocols.path(url);
  if ( !convertedUrl ) {
    console.error( `Failed to load page ${url} for window "${win.id}"` );
    return;
  }

  let argvHash = argv ? encodeURIComponent(JSON.stringify(argv)) : undefined;
  windowPlus.update(win, {
    url: url,
    argv: argv,
  });

  // if this is an exists local file
  if ( fs.existsSync(convertedUrl) ) {
    convertedUrl = url_.format({
      protocol: 'file',
      pathname: convertedUrl,
      slashes: true,
      hash: argvHash
    });
    win.loadURL(convertedUrl);

    return;
  }

  // otherwise we treat it as a normal url
  if ( argvHash ) {
    convertedUrl = `${convertedUrl}#${argvHash}`;
  }
  win.loadURL(convertedUrl);
};

/**
 * @method adjust
 * @param {BrowserWindow} win
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 *
 * Try to adjust the window to fit the position and size we give
 */
windowPlus.adjust = function (win, x, y, w, h ) {
  let adjustToCenter = false;

  if ( typeof x !== 'number' ) {
    adjustToCenter = true;
    x = 0;
  }

  if ( typeof y !== 'number' ) {
    adjustToCenter = true;
    y = 0;
  }

  if ( typeof w !== 'number' || w <= 0 ) {
    adjustToCenter = true;
    w = 800;
  }

  if ( typeof h !== 'number' || h <= 0 ) {
    adjustToCenter = true;
    h = 600;
  }

  let display = electron.screen.getDisplayMatching( { x: x, y: y, width: w, height: h } );
  win.setSize(w,h);
  win.setPosition( display.workArea.x, display.workArea.y );

  if ( adjustToCenter ) {
    win.center();
  } else {
    win.setPosition( x, y );
  }
};

/**
 * @method adjustToMain
 * @param {BrowserWindow} win
 *
 * adjust window position to make it open in the same display screen as main window
 */
windowPlus.adjustToMain = function (win) {
  let display = electron.screen.getDisplayMatching( _mainwin.getBounds() );
  let size = win.getSize();
  let x = (display.workArea.width - size[0]) * 0.5;
  let y = (display.workArea.height - size[1]) * 0.5;
  x = Math.floor(display.workArea.x + x);
  y = Math.floor(display.workArea.y + y);

  win.setPosition(x, y);

  // DISABLE
  // if ( x < 0 || y < 0 ) {
  //   win.setPosition( display.workArea.x, display.workArea.y );
  //   // NOTE: if we don't do this, the center will not work
  //   setImmediate(() => {
  //     win.center();
  //   });
  // } else {
  //   win.setPosition(x, y);
  // }
};

/**
 * @method on
 * @param {string} eventName - The name of the event
 * @param {function} listener - The callback function
 *
 * Adds an event listener function.
 */
windowPlus.on = function ( eventName, listener ) {
  return emitter.on.apply(emitter, [eventName, listener]);
};

/**
 * @method off
 * @param {string} eventName - The name of the event
 * @param {function} listener - The callback function
 *
 * Removes an event listener function.
 */
windowPlus.off = function ( eventName, listener ) {
  return emitter.removeListener.apply(emitter, [eventName, listener]);
};

/**
 * @method once
 * @param {string} eventName - The name of the event
 * @param {function} listener - The callback function
 *
 * Adds a one time event listener function.
 */
windowPlus.once = function ( eventName, listener ) {
  return emitter.once.apply(emitter, [eventName, listener]);
};

/**
 * @property {BrowserWindow} main
 *
 * The main window.
 */
Object.defineProperty(windowPlus, 'main', {
  enumerable: true,
  set (value) { _mainwin = value; },
  get () { return _mainwin; },
});

// ==========================
// internals
// ==========================

function _getWinInfo ( winID ) {
  for ( let i = 0; i < _winInfos.length; ++i ) {
    let winInfo = _winInfos[i];
    if ( winInfo.id === winID ) {
      return winInfo;
    }
  }

  return null;
}

// Save current window's state to profile `layout.windows.json` at `local`
function _saveWindowStates () {
  // we've quit the app, do not save layout after that.
  if ( !_mainwin ) {
    return;
  }

  // we don't load the windows profile, don't save any.
  if ( !_windowsProfile ) {
    return;
  }

  //
  let profileData = _windowsProfile.data;
  profileData.version = profileVersion;
  profileData.windows = [];

  for ( let i = 0; i < _winInfos.length; ++i ) {
    let winInfo = _winInfos[i];
    let win = BrowserWindow.fromId(parseInt(winInfo.id));

    if ( !win ) {
      continue;
    }

    let winBounds = win.getBounds();

    if ( !winBounds.width ) {
      console.warn(`Failed to commit window state. Invalid window width: ${winBounds.width}`);
      winBounds.width = 800;
    }

    if ( !winBounds.height ) {
      console.warn(`Failed to commit window state. Invalid window height ${winBounds.height}`);
      winBounds.height = 600;
    }

    let url = winInfo.url;
    if ( !url ) {
      url = win.webContents.getURL();
    }

    profileData.windows.push({
      uuid: winInfo.uuid,
      url: url,
      argv: winInfo.argv,
      main: win === _mainwin,
      x: winBounds.x,
      y: winBounds.y,
      width: winBounds.width,
      height: winBounds.height,
    });

    // TODO: move to dockable
    // // save the position and size for standalone panel window
    // // NOTE: only when panel is the only one in the window and the window is not the main window
    // let panels = panel.getPanels(win.id);

    // if ( win !== _mainwin && panels.length === 1 ) {
    //   let panelID = panels[0];

    //   profileData.panels[panelID] = {
    //     x: winBounds.x,
    //     y: winBounds.y,
    //     width: winBounds.width,
    //     height: winBounds.height,
    //   };
    // }

    // TODO: emitter.emit('save', _windowsProfile);
  }

  _windowsProfile.save();
}

// ==========================
// events
// ==========================

// NOTE: put a default function and don't do anything in it.
// this will make sure even all window closed, the app still not quit.
// This help us for:
//   1. Not quit the app when we start a unit-test with a window.
//   2. Not quit the app when run and close a hidden window before main-window opened.
//   3. Prevent crash when we press ^C to shut down the app.
app.on('window-all-closed', () => {});

// NOTE: this only happends when you force quit by pressing ^C in terminal
app.on('before-quit', () => {
  _saveWindowStates();

  // destroy all window immediately (avoid window pop-up messagebox in beforeUnload)
  let windows = BrowserWindow.getAllWindows();
  for ( let i = 0; i < windows.length; ++i ) {
    let win = windows[i];
    win.destroy();
  }
});
