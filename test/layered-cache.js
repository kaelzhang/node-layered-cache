import test from 'ava'
import LRU from 'lru-cache'
import delay from 'delay'
import LCache, {
  Layer
} from '../src'


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

class FakeCacheWhenAsync extends FakeCache {
  async validate (key, value) {
    return value > 2
  }
}


class FakeCacheWhenSync extends FakeCache {
  validate (key, value) {
    return value > 5
  }
}

test.only('basic', async t => {
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

  const v = await cache.get(1)
  console.log('v', v)
  t.is(v, 2, 'cache')
  // t.is(await cache._layers[0].get(1), 2, 'layer 0')
  // t.is(await cache._layers[1].get(1), 2, 'layer 1')
  // t.is(await cache._layers[2].get(1), 2, 'layer 2')
})


test('when async', async t => {
  const cache = new LCache([
    // 0
    new LRU(),
    new FakeCacheWhenAsync(),
    {
      get (n) {
        return n + 1
      }
    }
  ])

  t.is(await cache.get(1), 2, 'cache')
  t.is(await cache._layers[0].get(1), 2, 'layer 0 should cache')
  t.is(await cache._layers[1].get(1), undefined, 'layer 1 should not cache')

  t.is(await cache.get(2), 3, 'cache')
  t.is(await cache._layers[0].get(2), 3, 'layer 0 should cache')
  t.is(await cache._layers[1].get(2), 3, 'layer 1 should cache')
})


test('when async', async t => {
  const cache = new LCache([
    // 0
    new LRU(),
    new FakeCacheWhenSync(),
    {
      get (n) {
        return n + 1
      }
    }
  ])

  t.is(await cache.get(1), 2, 'cache')
  t.is(await cache._layers[0].get(1), 2, 'layer 0 should cache')
  t.is(await cache._layers[1].get(1), undefined, 'layer 1 should not cache')
})
