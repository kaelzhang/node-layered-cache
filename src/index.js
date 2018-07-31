const Layer = require('./layer')

const isUnset = value => value === undefined || value === null

class LayeredCache {
  constructor (layers, {
    isNotFound = isUnset
  } = {}) {

    this._layers = layers.map(layer => new Layer(layer))
    this._length = this._layers.length
    this._isNotFound = isNotFound
  }

  depth () {
    return this._length
  }

  layer (n) {
    return n < 0
      ? this._layers[this._length + n]
      : this._layers[n]
  }

  async msync (...keys) {
    const values = await this.layer(-1).mget(...keys)
    const pairs = []
    values.forEach((value, i) => {
      if (this._isNotFound(value)) {
        return
      }

      pairs.push([keys[i], value])
    })

    const tasks = this._layers
    .slice(0, -1)
    .map(layer => layer.mset(...pairs))

    await Promise.all(tasks)
    return values
  }

  // Sync
  sync (key) {
    return this.msync(key).then(values => values[0])
  }

  async mget (...keys) {
    if (!keys.length) {
      return []
    }

    const tasks = []
    const values = await this._traverseGet(0, keys, tasks)

    if (tasks.length) {
      await Promise.all(tasks)
    }

    return values
  }

  get (key) {
    return this.mget(key).then(values => values[0])
  }

  // Recursively read cached values
  // or deep down to lower cache layer if there is at least a key is not cached.
  // @param {Array<Promise>} tasks Array of set tasks of the previous job.
  async _traverseGet (index, keys, tasks) {
    const layer = this._layers[index]
    const values = await layer.mget(...keys)

    if (++ index >= this._length) {
      return values
    }

    const keyIndexes = []
    const keysOfMissedValues = values.reduce((missed, value, i) => {
      if (this._isNotFound(value)) {
        keyIndexes.push(i)
        missed.push(keys[i])
      }

      return missed
    }, [])

    if (!keysOfMissedValues.length) {
      return values
    }

    const valuesFromLowerLayer = await this._traverseGet(
      index, keysOfMissedValues, tasks)

    const keyValuePairsToSet = []
    valuesFromLowerLayer.forEach((value, i) => {
      if (this._isNotFound(value)) {
        return
      }

      // Update old values
      values[keyIndexes[i]] = value
      const key = keysOfMissedValues[i]
      keyValuePairsToSet.push([key, value])
    })

    if (keyValuePairsToSet.length) {
      // Update the cache of the current layer
      tasks.push(layer.mset(...keyValuePairsToSet))
    }

    return values
  }

  _forEach (fn) {
    return Promise.all(this._layers.map(fn))
  }

  set (key, value) {
    return this._forEach(layer => layer.set(key, value))
  }

  mset (...pairs) {
    return this._forEach(layer => layer.mset(...pairs))
  }
}

LayeredCache.Layer = Layer

module.exports = LayeredCache
