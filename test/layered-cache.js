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

class FakeCacheAsyncValidate extends FakeCache {
  constructor (min) {
    super()

    this._min = min
  }

  async validate (key, value) {
    return value > this._min
  }
}


class FakeCacheSyncValidate extends FakeCache {
  constructor (min) {
    super()

    this._min = min
  }

  validate (key, value) {
    return value > this._min
  }
}

test('basic, single / batch, with lru-cache', async t => {
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

  t.is(cache.depth(), 4, 'depth')

  t.is(await cache.get(1), 2, 'cache')
  t.is(await cache.layer(0).get(1), 2, 'layer 0')
  t.is(await cache.layer(1).get(1), 2, 'layer 1')
  t.is(await cache.layer(2).get(1), 2, 'layer 2')

  t.deepEqual(await cache.mget(3, 4), [4, 5], 'batch: cache')
  t.deepEqual(await cache.layer(0).mget(3, 4), [4, 5], 'batch: layer 0')
  t.deepEqual(await cache.layer(1).mget(3, 4), [4, 5], 'batch: layer 1')
  t.deepEqual(await cache.layer(2).mget(3, 4), [4, 5], 'batch: layer 2')

  t.deepEqual(await cache.mget(), [], 'empty mget')
})


test('when async, single / batch', async t => {
  const cache = new LCache([
    // 0
    new LRU(),
    new FakeCacheAsyncValidate(2),
    {
      get (n) {
        return n + 1
      }
    }
  ])

  t.is(await cache.get(1), 2, 'cache')
  t.is(await cache.layer(0).get(1), 2, 'layer 0 should cache')
  t.is(await cache.layer(1).get(1), undefined, 'layer 1 should not cache')

  t.is(await cache.get(2), 3, 'cache')
  t.is(await cache.layer(0).get(2), 3, 'layer 0 should cache')
  t.is(await cache.layer(1).get(2), 3, 'layer 1 should cache')

  t.deepEqual(await cache.mget(0, -1), [1, 0], 'mget: cache')
  t.deepEqual(await cache.layer(0).mget(0, -1), [1, 0], 'mget: layer 0 should cache')
  t.deepEqual(await cache.layer(1).mget(0, -1), [undefined, undefined], 'mget: layer 1 should not cache')

  t.deepEqual(await cache.mget(), [], 'empty mget')
})


test('when sync, single / batch', async t => {
  const cache = new LCache([
    // 0
    new LRU(),
    new FakeCacheSyncValidate(3),
    {
      get (n) {
        return n + 1
      }
    }
  ])

  t.is(await cache.get(1), 2, 'cache')
  t.is(await cache.layer(0).get(1), 2, 'layer 0 should cache')
  t.is(await cache.layer(1).get(1), undefined, 'layer 1 should not cache')

  t.deepEqual(await cache.mget(0, -1), [1, 0], 'mget: cache')
  t.deepEqual(await cache.layer(0).mget(0, -1), [1, 0], 'mget: layer 0 should cache')
  t.deepEqual(await cache.layer(1).mget(0, -1), [undefined, undefined], 'mget: layer 1 should not cache')

  t.deepEqual(await cache.mget(), [], 'empty mget')
})


test('error, no get', async t => {
  try {
    new LCache([{}])
  } catch (e) {
    t.is(e.code, 'ERR_NO_GET', 'code')

    return
  }

  t.fail('should fail')
})


function level (n, ...extra) {
  const layers = []
  while (n --) {
    layers.push(new FakeCache())
  }

  if (extra.length) {
    layers.push(...extra)
  }

  return new LCache(layers)
}


test('existing data', async t => {
  const cache = level(3)

  // Wrong value actually
  await cache.layer(0).mset([1, 3], [2, 2])
  await cache.layer(0).set(3, 1)

  // Should go for broke
  t.deepEqual(await cache.mget(1, 2, 3), [3, 2, 1])
})


test('set all', async t => {
  const cache = level(2)
  await cache.set(1, 3)
  t.is(await cache.layer(0).get(1), 3, 'layer 0')
  t.is(await cache.layer(1).get(1), 3, 'layer 1')
})


test('mset all', async t => {
  const cache = level(2)
  await cache.mset([1, 3], [2, 5])
  t.deepEqual(await cache.layer(0).mget(1, 2), [3, 5], 'layer 0')
  t.deepEqual(await cache.layer(1).mget(1, 2), [3, 5], 'layer 1')
})

test('undefined value from low-level cache', async t => {
  const layer0 = new FakeCache()

  const cache = new LCache([
    layer0, {
      get (n) {
        return n % 2
          ? n
          : undefined
      }
    }
  ])

  t.deepEqual(await cache.mget(1, 2, 3), [1, undefined, 3], 'cache value')
  t.is(await layer0.has(2), false, 'should skip setting undefined value')

  // nothing to be set to upper layer, overage
  t.deepEqual(await cache.mget(4, 6), [undefined, undefined], 'empty result')
  t.is(await layer0.has(2), false, 'should skip setting')
})


test('hit from layer 0', async t => {
  const cache = new LCache([
    {
      get: n => n
    },
    new FakeCache,
    new FakeCache
  ])

  t.is(await cache.get(1), 1, 'value')
  t.is(await cache.layer(1).get(1), undefined, 'should not set to low level cache')
})

test('directly set / get to layer', async t => {
  const cache = new LCache([
    new FakeCacheAsyncValidate(3)
  ])

  await cache.layer(0).set(1, 2)
  t.is(await cache.get(1), undefined)

  await cache.layer(0).set(1, 5)
  t.is(await cache.layer(0).get(1), 5)
})


test('cache without has method', async t => {
  const layer0 = new FakeCache
  layer0.has = null

  const cache = new LCache([layer0])

  await cache.set(1, 2)
  t.is(await cache.layer(0).get(1), 2)
})

test('no set', async t => {
  const cache = new LCache([{
    get () {}
  }, {
    get: () => 1
  }])

  t.is(await cache.get(1), 1)

  await cache.layer(0).set(1, 1)
})

test('isUnset not specified', async t => {
  const cache = new LCache([
    {
      get (n) {
        return n % 2
          ? null
          : undefined
      }
    },
    {
      get: () => 1
    }
  ])

  t.deepEqual(await cache.mget(1, 2, 3, 4), [1, 1, 1, 1])
})

test('isUnset specified', async t => {
  const cache = new LCache([
    {
      get (n) {
        return n % 2
          ? null
          : undefined
      }
    },
    {
      get: () => 1
    }
  ], {
    isNotFound (v) {
      return v === undefined
    }
  })

  t.deepEqual(await cache.mget(1, 2, 3, 4), [null, 1, null, 1])
})

test('sync and msync', async t => {
  const l = new LRU
  const f = new FakeCache
  const layers = [
    l,
    f
  ]

  const cache = new LCache(layers)

  l.set(1, 2)
  l.set(2, 3)
  l.set(3, 4)
  await f.set(1, 3)
  await f.set(2, 4)
  await f.set(3, 5)

  t.is(await cache.get(1), 2, 'cache get')
  t.deepEqual(await cache.mget(1, 2), [2, 3], 'cache get')

  t.is(await cache.sync(1), 3, 'cache sync return value')
  t.deepEqual(await cache.msync(2, 3, 4), [4, 5, undefined], 'cache sync return value')
})
