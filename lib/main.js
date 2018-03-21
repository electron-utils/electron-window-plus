'use strict';

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
const profileUrl = 'profile://local/electron-window-plus.state.json';

profile.registerSchema(profileUrl, {
  version: profileVersion,
  windows: [],
});

let _winInfos = [];
let _mainwin = null;
let _windowsProfile = null;

// NOTE: this variable will set to true (and never turn to false) when you call `windowPlus.manage()`.
// This variable will help windowPlus notice if we should quit the app when `window-all-closed`.
let _managed = false;

// ==========================
// exports
// ==========================

/**
 * @module windowPlus
 */
let windowPlus = {};
module.exports = windowPlus;

/**
 * @method restore
 * @param [defaultUrl] {string}
 * @param [opts] {object}
 */
windowPlus.restore = function (defaultUrl, opts) {
  _windowsProfile = profile.load(profileUrl);

  // failed to load the profile, create a default window instead
  if ( _windowsProfile ) {
    // reset layout if the version is not the same
    if ( _windowsProfile.get('version') !== profileVersion ) {
      _windowsProfile.reset({
        version: profileVersion,
        windows: [],
      });
    }

    let winStates = [];

    // create and manage windows
    let windowInfos = _windowsProfile.get('windows');
    for ( let i = 0; i < windowInfos.length; ++i ) {
      let state = windowInfos[i];
      let win;

      if ( state.main ) {
        // NOTE: It is possible we change default options during development, so event we restore
        //       a window, we should always apply default options for the main window.

        // clone the opts
        let opts2 = Object.assign({}, opts);
        opts2.show = false;

        if ( state.fullscreen ) {
          opts2.fullscreen = true;
        }
        win = new BrowserWindow(opts2);
        _mainwin = win;
      } else {
        win = new BrowserWindow({
          show: false
        });
      }

      // manage the win
      windowPlus.manage(win, state.uuid, state.userdata);

      //
      winStates.push({ win, state });
    }

    // restore window
    for ( let i = 0; i < winStates.length; ++i ) {
      let winState = winStates[i];
      let win = winState.win;
      let state = winState.state;

      // TODO: several window states to set
      // win._browserWin.setMenuBarVisibility(state.menuBarVisible);

      windowPlus.adjust(
        win, state.x, state.y, state.width, state.height
      );
      win.show();

      // if we provide defaultUrl, and main window url is different to default, reset it.
      let url = state.url;
      if ( state.main && defaultUrl && defaultUrl !== url ) {
        console.warn('Main window url changed, reset it to default.');
        url = defaultUrl;
      }

      //
      windowPlus.loadURL(win, url, state.argv);
    }
  }

  // if we still not found the main window, but we do provide url
  if ( !_mainwin && defaultUrl ) {
    _mainwin = new BrowserWindow(opts);
    windowPlus.manage(_mainwin);

    _mainwin.show();
    windowPlus.loadURL(_mainwin, defaultUrl);
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
 * @param {string} [uuid]
 * @param {object} [userdata]
 */
windowPlus.manage = function (win, uuid, userdata) {
  _managed = true;

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
    uuid: uuid || uuidV4(),
    userdata: userdata || {},
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

  // if we failed to load main window, go to failed page and clear the profile.
  win.webContents.on('did-fail-load', () => {
    if ( win === _mainwin ) {
      _mainWindowFailed();
    }
  });

  win.webContents.on('did-navigate-in-page', (event, url) => {
    let info = _getWinInfo(win.id);
    if ( info ) {
      info.url = url;
    }
  });

  emitter.emit('manage', win);
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
  emitter.emit('unmanage', win);

  return true;
};

/**
 * @method updateUserData
 * @param {BrowserWindow|number} win
 * @param {object} userdata
 */
windowPlus.updateUserData = function (win, userdata) {
  if (!_managed) {
    return;
  }

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

  for ( let name in userdata ) {
    src.userdata[name] = userdata[name];
  }
};

/**
 * @method getUserData
 * @param {BrowserWindow|number} win
 */
windowPlus.getUserData = function (win) {
  let winID = -1;

  if ( typeof win === 'number' ) {
    winID = win;
  } else if ( win instanceof BrowserWindow ) {
    winID = win.id;
  }

  let info = _getWinInfo(winID);
  if ( info ) {
    return info.userdata;
  }

  return null;
};

/**
 * @method save
 */
windowPlus.save = function () {
  _saveWindowStates();
};

/**
 * @method reset
 */
windowPlus.reset = function () {
  _winInfos = [];
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
    console.error( `Failed to load page for window "${win.id}": url ${url} convert error.` );

    if ( win === _mainwin ) {
      _mainWindowFailed();
    }
    return;
  }

  let argvHash = argv ? encodeURIComponent(JSON.stringify(argv)) : undefined;
  let info = _getWinInfo(win.id);
  if ( info ) {
    info.url = url;
    info.argv = argv;
  }

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
  if ( !_mainwin ) {
    return;
  }

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
  let windowInfos = [];

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

    let winProfile = {
      // winInfo
      uuid: winInfo.uuid,
      url: winInfo.url || win.webContents.getURL(),
      argv: winInfo.argv,
      userdata: winInfo.userdata,
      fullscreen: win === _mainwin ? win.isFullScreen() : false,

      // win states
      main: win === _mainwin,
      x: winBounds.x,
      y: winBounds.y,
      width: winBounds.width,
      height: winBounds.height,
    };

    windowInfos.push(winProfile);

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
  }

  _windowsProfile.set('version', profileVersion);
  _windowsProfile.set('windows', windowInfos);

  emitter.emit('save', _windowsProfile);
  _windowsProfile.save();
}

function _mainWindowFailed () {
  windowPlus.reset();

  // if user register the 'main-window-failed' event, emit it and skip load failed.html page
  if ( emitter.listeners('main-window-failed').length > 0 ) {
    emitter.emit('main-window-failed');
    return;
  }

  _mainwin.setSize(400, 300);
  _mainwin.loadURL(`file://${__dirname}/failed.html`);
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
app.on('window-all-closed', () => {
  // NOTE: if user didn't manage windows by electron-window-plus, we should quit the app.
  if (_managed) {
    return;
  }

  app.quit();
});

// NOTE: this only happends when you force quit by pressing ^C in terminal
app.on('before-quit', () => {
  // NOTE: DO NOT do this in unmanaged state, which will lead to crash due to the re-destroy of a closed window.
  if (_managed) {
    _saveWindowStates();

    // destroy all window immediately (avoid window pop-up messagebox in beforeUnload)
    let windows = BrowserWindow.getAllWindows();
    for (let i = 0; i < windows.length; ++i) {
      let win = windows[i];
      win.destroy();
    }
  }
});
