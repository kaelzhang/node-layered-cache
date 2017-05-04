[![Build Status](https://travis-ci.org/kaelzhang/node-layered-cache.svg?branch=master)](https://travis-ci.org/kaelzhang/node-layered-cache)
<!-- optional appveyor tst
[![Windows Build Status](https://ci.appveyor.com/api/projects/status/github/kaelzhang/node-layered-cache?branch=master&svg=true)](https://ci.appveyor.com/project/kaelzhang/node-layered-cache)
-->
<!-- optional npm version
[![NPM version](https://badge.fury.io/js/layered-cache.svg)](http://badge.fury.io/js/layered-cache)
-->
<!-- optional npm downloads
[![npm module downloads per month](http://img.shields.io/npm/dm/layered-cache.svg)](https://www.npmjs.org/package/layered-cache)
-->
<!-- optional dependency status
[![Dependency Status](https://david-dm.org/kaelzhang/node-layered-cache.svg)](https://david-dm.org/kaelzhang/node-layered-cache)
-->

# layered-cache

The manager to handle hierarchical cache layers.

## Usage

```js
const LRU = require('lru-cache')
const cache = require('layered-cache')([{
  new LRU({max: 500})
}, {
  async set (key, value) {
    return save_to_db(key, value)
  },
  async get (key) {
    return get_from_db(key)
  }
}, {
  async get (key) {
    return fetch_from_remote(key)
  }
}])

cache.get('foo')  // 'bar'
```

![flow](flow.png)

## License

MIT
