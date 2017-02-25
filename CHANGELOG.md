## CHANGELOG

### v1.3.1

  - Fix user data not load.
  - Reset the window when main window's url is different than default.

### v1.3.0

  - Fix user field not save to window profile when we call `windowPlus.update()`.
  - Emit `main-window-failed` event when main window loading failed.
  - Handle main window loading failed when the url is null.

### v1.2.1

  - Fix app can not quit after all windows closed while we don't use `electron-window-plus` manage windows. 

### v1.2.0

  - Add event: manage
  - Add event: unmanage
  - Add event: save
  - Add API: getWinInfo

### v1.1.0

  - Add failed page when main window loading failed.