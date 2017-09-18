// The cache wrapper
// - queuing
// - feature support

import Queue from 'pending-queue'
import { EventEmitter } from 'events'


export default class Layer extends EventEmitter {
  constructor (cache) {
    super()

    if (cache instanceof Layer) {
      return cache
    }

    this._supported = {}
    this._get_queue = new Queue({
      stringify: cache.stringify || JSON.stringify,
      load: key => cache.get(key)
    })

    this._cache = cache

    this._testSupport('has')
    this._testSupport('validate')
    this._testSupport('mget')
    this._testSupport('mset')
    this._testSupport('set')
  }

  _testSupport (name) {
    if (typeof this._cache[name] === 'function') {
      this._supported[name] = true
    }
  }

  support (method) {
    return !!this._supported[method]
  }

  // The wrapped instance of LCache.Layer
  // will have no `has` method
  async get (key) {
    const has = this._supported.has
      ? await this._cache.has(key)
      : true

    if (!has) {
      return
    }

    return this._get_queue.add(key).then(data => {
      this.emit('data', data)
      return data
    })
  }

  async mget (keys) {
    return keys.length
      ? keys.length === 1
        ? [await this.get(keys[0])]
        : this._supported.mget
          ? this._cache.mget(keys)
          : Promise.all(keys.map(key => this.get(key)))
      : []
  }

  async set (key, value) {
    const should = this._supported.validate
      ? await this._cache.validate(key, value)
      : true

    if (!should) {
      return
    }

    return this._cache.set(key, value)
  }

  async mset (pairs) {
    if (this._supported.mset) {
      return this._cache.mset(pairs)
    }

    if (!pairs.length) {
      return
    }

    return pairs.length === 1
      ? this.set(...pairs[0])
      : Promise.all(pairs.map(pair => this.set(...pair)))
  }
}
