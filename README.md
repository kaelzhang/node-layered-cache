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
const LCache = require('layered-cache')
const cache = new LCache([{
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

## class LCache(layers)

- **layers** `Array.<Object|LCache.Layer>` list of subtile layers. A layer must have
  - a `get(key)` method to get the cache, either sync or async
  - a `set(key, value)` method to set the cache value, either sync or async. The method is optional only for the last layer.
  - an optional `has(key) : Boolean` method to detect if a key is already in the cache.
  - an optional `validate(key, value) : Boolean` to validate the value and determine whether a value from a low-level cache should be saved.

If the item in the `layers` is not a `LCache.Layer`, it will be wrapped as `LCache.Layer`.

### class LCache.Layer(layer)

The wrapper class to wrap the cache layer into an [`EventEmitter`](https://nodejs.org/dist/latest-v7.x/docs/api/events.html#events_class_eventemitter), and make sure `get`, `set`, `has` methods are all asynchronous methods, and provides:

- a `data` event after the `get` method is executed, so that the external program could known what is happening
- queues all `get` requests with same keys.
- an extra `support(method): Boolean` method.

```js
const delay = require('delay')
const store = {}
const layer = new LCache.Layer({
  get (x) {
    return delay(100).then(() => x + 1)
  },

  set (key, value) {
    store[key] = value
  },

  has (key) {
    return key in store
  }
})
.on('data', data => {
  console.log('on data', data)
})

layer.support('has')             // true
layer.has(1).then(console.log)   // prints: false

layer.get(1).then(console.log)
// prints: on data 2
// prints: 2
```

## License

MIT
