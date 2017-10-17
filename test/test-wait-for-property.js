const test = require('./setup')

// for some reason these aren't working with client setups

test.multi('waitForProperty already there same tick', async (t) => {
  const obj = t.db.create({a: 10})
  const val = await t.db.waitForProperty(obj, 'a')
  t.equal(val, 10)
  t.end()
})

test.multi('waitForProperty already there, sleep', async (t) => {
  const obj = t.db.create({a: 10})
  await t.sleep(20)
  const val = await t.db.waitForProperty(obj, 'a')
  t.equal(val, 10)
  t.end()
})

test.multi('waitForProperty added later same tick', async (t) => {
  const obj = t.db.create()
  const promiseOfVal = t.db.waitForProperty(obj, 'a')
  t.db.setProperty(obj, 'a', 10)
  promiseOfVal.then(val => {
    t.equal(val, 10)
    t.end()
  })
})

test.multi('waitForProperty added after sleep', async (t) => {
  const obj = t.db.create()
  const promiseOfVal = t.db.waitForProperty(obj, 'a')
  await t.sleep(20)
  t.db.setProperty(obj, 'a', 10)
  promiseOfVal.then(val => {
    t.equal(val, 10)
    t.end()
  })
})

test.multi('waitForProperty timeout', async (t) => {
  const obj = t.db.create()
  const promiseOfVal = t.db.waitForProperty(obj, 'a', 100)
  promiseOfVal.then(val => {
    t.equal(val, undefined)
    t.end()
  })
})
