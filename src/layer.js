// The cache wrapper
// - queuing
// - feature support

const Queue = require('pending-queue')
const { EventEmitter } = require('events')

class Layer extends EventEmitter {
  constructor (cache) {
    super()

    if (cache instanceof Layer) {
      return cache
    }

    this._supported = []
    this._get_queue = new Queue({
      stringify: cache.stringify || JSON.stringify,
      load (key) {
        return cache.get(key)
      }
    })

    this._cache = cache

    if (typeof cache.has === 'function') {
      this._supported.push('has')
    }
  }

  support (method) {
    return !!~this._supported.indexOf(method)
  }

  async has (key) {
    return this._cache.has(key)
  }

  async get (key) {
    return this._get_queue.add(key).then(data => {
      this.emit('data', data)
      return data
    })
  }

  async set (key, value) {
    return this._cache.set(key, value)
  }
}


module.exports = Layer

