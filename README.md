[![Build Status](https://travis-ci.org/kaelzhang/node-layered-cache.svg?branch=master)](https://travis-ci.org/kaelzhang/node-layered-cache)
[![Coverage](https://codecov.io/gh/kaelzhang/node-layered-cache/branch/master/graph/badge.svg)](https://codecov.io/gh/kaelzhang/node-layered-cache)


# layered-cache

The manager to handle hierarchical cache layers.

## Usage

```js
import LRU from 'lru-cache'
import LCache from 'layered-cache'

const cache = new LCache([
  // LRU cache
  new LRU({max: 100}),

  // databases
  {
    set: (key, value) => save_to_db(key, value),
    get: async key => await get_from_db(key)
  },

  // remote servers
  {
    get: key => fetch_from_remote(key)
  }
])

cache.get('foo')  // 'bar'
```

For the example above, at first, there was no cache for `'foo'` either in LRU cache(layer 0), or in databases(layer 1). And `LCache` tries to fetch the value of `'foo'` from remote server, and gets the value of `'bar'`.

Then, `LCache` saves `{foo: 'value'}` to both layer 0 and layer 1.

If we try to get the value of `'foo'` again, it will hit on layer 0. And after a long time, if the value of `'foo'` have been erased by LRU cache, `LCache` will the the value from databases(layer 1).

To make the cache simple enough, **ALL VALUES** that equal to `undefined` or `null` are treated as **NOT FOUND** in the cache or cache layers. You could specify the behavior via `options.isNotFound`.

![flow](flow.png)

## class LCache(layers, options)

- **layers** `Array<LCache.InterfaceLayer|LCache.Layer>` list of cache layers. A layer must implement the interface of `LCache.InterfaceLayer`. In the other words, a layer should have the following structures, but there is no restriction about which type the layer is. A layer could be a singleton(object), or a class instance(with properties from its prototype).
- **options** `Object=`
  - **isNotFound** `function(value): Boolean` to determine whether a value is not found.

### interface `LCache.InterfaceLayer`

- **get** `?function(key: any): any` method to get the cache, either synchronous or asynchronous(function that returns `Promise` or async function).
  - **key** `any` the key to retrieve the cached value could be of any type which `layered-cache` never concerns.
- **mget** `?function(...keys): Array<any>` an optional method to get multiple data by keys
- **set** `?function(key, value: any)` method to set the cache value, either sync or async. The method could be optional only for the last layer.
- **mset** `?function(pairs: Array<[key: any, value: any]>)` an optional method to set multiple values by keys.
- **has** `?function(key) : Boolean` an optional method to detect if a key is already in the cache, either sync or async.
- **mhas** `?function(...keys) : Array<Boolean>` an optional method to detect the existence of multiple keys, either sync or async.
- **validate** `?function(key, value) : Boolean` an optional method to validate the value and determine whether a value from a low-level cache should be saved.
- **mvalidate** `?function(pairs: Array<[key: any, value: any]>) : Array<Boolean>` an optional method to validate multiple key-value pairs and determine whether a value from a low-level cache should be saved.

At least one of `get` or `mget` must be specified, or it will throw an error.

### cache.get(key)

- **key** `any` the layered cache could accept arbitrary type of `key`

Gets a value by key, and returns `Promise<any>` the retrieved value.

Take `lru-cache` for example, which by default does not support arbitrary type of `key`, but we can use this simple trick:

```js
import _LRU from 'lru-cache'

class LRU {
  constructor () {
    this._cache = new _LRU({
      max: 10000
    })
  }

  get (key) {
    return this._cache.get(JSON.stringify(key))
  }

  set (key, value) {
    return this._cache.set(JSON.stringify(key), value)
  }
}
```

### cache.mget(...keys)

- **keys** `Array`

Gets an group of values by keys, and returns `Promise<Array>`

### cache.set(key, value)

Sets key-value to all writable cache layers.

Returns `Promise`

### cache.mset(...pairs)

- **pairs** `Array<[key, value]>`

Sets multiple key-value pairs.

Returns `Promise`

```js
await cache.mset(['foo', 'bar'], ['baz', 'quux'])
```

### cache.sync(key)

Synchronize the value of key from the most underlying layer up to the upper layers.

Returns the same data type as `cache.get(key)`

### cache.msync(...keys)

Synchronize the value of each key from the most underlying layer up to the upper layers.

Returns the same data type as `cache.mget(...keys)`

### cache.depth()

Returns `number` the depth of the cache layers.

### cache.layer(n)

- **n** `number` the index of the layer. The `n` starts with `0`, from high level to low level, which means the layer index of the highest level is `0`

Returns `LCache.Layer`

```js
console.log(await cache.layer(0).get('foo'))
```

## class LCache.Layer(layer: LCache.InterfaceLayer)

The wrapper class to wrap the cache layer, and always and only provides FOUR asynchronous methods, `get`, `mget`, `set` and `mset`.


```js
import {
  Layer
} from 'layered-cache'
import delay from 'delay'

const store = {}
const layer = new Layer({
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

layer.get(1).then(console.log)
// prints: on data 2
// prints: 2
```

## License

MIT
