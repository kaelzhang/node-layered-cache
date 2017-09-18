// The cache wrapper
// - queuing
// - feature support

import error from 'err-code'
import wrap from 'single-batch'


const filterThenSingle = (key, filter, single, spread) => {
  return (
    spread
      ? filter(...key)
      : filter(key)
  )
  .then(available => {
    if (!available) {
      return
    }

    return spread
      ? single(...key)
      : single(key)
  })
}

const filterThenBatch = (keys, filter, batch) => {
  return filter(...keys)
  .then(availables => {
    const filteredKeys = keys.filter((key, i) => {
      if (availables[i]) {
        return true
      }
    })

    return batch(...filteredKeys).then(values => {
      let i = 0
      return availables.map(available => {
        if (!available) {
          return undefined
        }

        return values[i ++]
      })
    })
  })
}


export default class Layer {
  constructor (cache) {

    if (cache instanceof Layer) {
      return cache
    }

    this._supported = {}

    this._cache = cache
    this._get = wrap('get', 'mget', cache, true)

    if (!this._get) {
      throw error('either get or mget should be implemented.', 'ERR_NO_GET')
    }

    this._has      = wrap('has',      'mhas', cache, true)
    this._validate = wrap('validate', 'mvalidate', cache)
    this._set      = wrap('set',      'mset', cache)
  }

  async get (key) {
    return this._has
      ? filterThenSingle(key, this._has.single, this._get.single)
      : this._get.single(key)
  }

  async mget (...keys) {
    return this._has
      ? filterThenBatch(keys, this._has.batch, this._get.batch)
      : this._get.batch(...keys)
  }

  async set (key, value) {
    if (!this._set) {
      return
    }

    return this._validate
      ? filterThenSingle(
        [key, value], this._validate.single, this._set.single, true)
      : this._set.single(key, value)
  }

  async mset (...pairs) {
    if (!this._set) {
      return
    }

    return this._validate
      ? filterThenBatch(pairs, this._validate.batch, this._set.batch)
      : this._set.batch(...pairs)
  }
}
