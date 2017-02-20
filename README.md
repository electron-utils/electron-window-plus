# electron-window-plus

[![Linux Build Status](https://travis-ci.org/electron-utils/electron-window-plus.svg?branch=master)](https://travis-ci.org/electron-utils/electron-window-plus)
[![Windows Build status](https://ci.appveyor.com/api/projects/status/7cf5xyawomjy3na2?svg=true)](https://ci.appveyor.com/project/jwu/electron-window-plus)
[![Dependency Status](https://david-dm.org/electron-utils/electron-window-plus.svg)](https://david-dm.org/electron-utils/electron-window-plus)
[![devDependency Status](https://david-dm.org/electron-utils/electron-window-plus/dev-status.svg)](https://david-dm.org/electron-utils/electron-window-plus#info=devDependencies)

Save and restore window states.

## Why?

  - Support multiple window state save and restore.

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
const windowPlus = require('electron-window-plus');

windowPlus.restore(`${__dirname}/index.html`, {
  center: true,
  width: 400,
  height: 300,
});
```

## API Reference

TODO

## License

MIT © 2017 Johnny Wu
