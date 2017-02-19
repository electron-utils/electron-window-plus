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

const profileVersion = '1.0.0';
const emitter = new EventEmitter();

let _manageID = 1000;
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
      let info = windowPlus.manage(win);
      info.manageID = state.manageID;
      info.url = state.url;
      info.argv = state.argv;

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
      let info = windowPlus.manage(_mainwin);
      info.url = url;

      _mainwin.show();
      windowPlus.loadURL(_mainwin, url);
    }
  }

  // NOTE: restored when we have one more window and also have a window set as main.
  if ( _mainwin ) {
    _mainwin.focus();
  }
};

/**
 * @method manage
 * @param {BrowserWindow} win
 */
windowPlus.manage = function (win) {
  let info = _getWinInfo(win);
  if ( info ) {
    console.warn( `Failed to add window ${win.id}: already added.` );
    return null;
  }

  if ( !_mainwin ) {
    _mainwin = win;
  }

  let winID = win.id;

  info = {
    id: winID,
    manageID: _manageID,
  };
  _winInfos.push(info);
  ++_manageID;

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

  return info;
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
 * @method on
 * @param {string} eventName - The name of the event
 * @param {function} listener - The callback function
 *
 * Adds an event listner function.
 */
windowPlus.on = function ( eventName, listener ) {
  return emitter.on.apply(emitter, [eventName, listener]);
};

/**
 * @method off
 * @param {string} eventName - The name of the event
 * @param {function} listener - The callback function
 *
 * Removes an event listner function.
 */
windowPlus.off = function ( eventName, listener ) {
  return emitter.removeListener.apply(emitter, [eventName, listener]);
};

/**
 * @method once
 * @param {string} eventName - The name of the event
 * @param {function} listener - The callback function
 *
 * Adds a one time event listner function.
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

/**
 * @property {boolean} empty
 *
 * If we have managed window
 */
Object.defineProperty(windowPlus, 'empty', {
  enumerable: true,
  get () { return _winInfos.length === 0; },
});

// ==========================
// internals
// ==========================

function _getWinInfo ( win ) {
  for ( let i = 0; i < _winInfos.length; ++i ) {
    let winInfo = _winInfos[i];
    if ( winInfo.id === win.id ) {
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

  let windows = BrowserWindow.getAllWindows();

  for ( let i = 0; i < windows.length; ++i ) {
    let win = windows[i];
    let winInfo = _getWinInfo(win);

    if ( !winInfo ) {
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
      manageID: winInfo.manageID,
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

