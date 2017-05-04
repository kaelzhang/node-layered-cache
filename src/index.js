const Layer = require('./layer')

class CacheManager {
  constructor (layers) {
    this._layers = layers.map(layer => new Layer(layer))
  }

  async get (key) {
    let i = 0
    const length = this._layers.length
    let layer

    for (; i < length; i ++) {
      layer = this._layers[i]

      if (layer.support('has')) {
        if (await layer.has(key)) {
          return layer.get(key)
        }

        continue
      }

      const value = await layer.get(key)
      if (value === undefined) {
        continue
      }

      await this._update(i, key, value)
      return value
    }
  }

  _update (i, key, value) {
    const tasks = []
    while (i --) {
      tasks.push(this._layers[i].set(key, value))
    }

    return Promise.all(tasks)
  }

  async set (key, value) {
    return this._update(this._layers.length, key, value)
  }
}


CacheManager.Layer = Layer

module.exports = CacheManager
