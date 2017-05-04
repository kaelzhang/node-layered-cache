const test = require('ava')
const LRU = require('lru-cache')
const delay = require('delay')
const LCache = require('..')
const Layer = LCache.Layer

class FakeCache {
  constructor () {
    this._data = {}
  }

  set (key, value) {
    return delay(10).then(() => {
      this._data[JSON.stringify(key)] = value
    })
  }

  get (key) {
    return delay(10).then(() => {
      return this._data[JSON.stringify(key)]
    })
  }

  async has (key) {
    return JSON.stringify(key) in this._data
  }
}

test('basic', async t => {
  const layers = [
    new LRU(),
    new FakeCache(),
    new Layer(new FakeCache()),
    {
      get (n) {
        return delay(10).then(() => n + 1)
      }
    }
  ]

  const cache = new LCache(layers)

  t.is(await cache.get(1), 2, 'cache')
  t.is(await cache._layers[0].get(1), 2, 'layer 0')
  t.is(await cache._layers[1].get(1), 2, 'layer 1')
  t.is(await cache._layers[2].get(1), 2, 'layer 2')
})
