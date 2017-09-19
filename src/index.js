import Layer from './layer'


export {
  Layer
}


const isUnset = value => value === undefined || value === null

export default class LayeredCache {
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
    return this._layers[n]
  }

  async mget (...keys) {
    if (!keys.length) {
      return []
    }

    const tasks = []
    const values = await this._mget(0, keys, tasks)

    if (tasks.length) {
      await Promise.all(tasks)
    }

    return values
  }

  // Recursively read cached values
  // or deep down to lower cache layer if there is at least a key is not cached.
  // @param {Array<Promise>} tasks Array of set tasks of the previous job.
  async _mget (index, keys, tasks) {
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

    const valuesFromLowerLayer = await this._mget(
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

  async get (key) {
    const tasks = []
    const value = await this._mget(0, [key], tasks)

    if (tasks.length) {
      await Promise.all(tasks)
    }

    return value[0]
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
