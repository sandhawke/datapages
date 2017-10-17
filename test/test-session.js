const test = require('./setup')

// these want ws because our fake transport doesn't currently do sessions

test.multi({client: true, raw: true, ws: true}, 'session data raw', async (t) => {
  let trans = t.db.transport
  await t.db.waitForSession()
  //trans.on('$session-active', async () => {
  t.debug('SESSION ACTIVE')
  const sid = trans.sessionData.id
  t.debug('hello?')
  t.debug('sd %O', trans.sessionData)
  t.db.listenSince(0, 'delta', delta => {
    if (delta.subject === sid &&
        delta.property === '_isSession' &&
        delta.value === true) {
      t.ok(true)
      t.end()
    }
  })
  // })
})

test.multi({client: true, proxy: true, ws: true}, 'session data proxy', async (t) => {
  let trans = t.db.transport
  if (!trans) trans = t.db.rawClient.transport
  await t.db.waitForSession()
  // trans.on('$session-active', async () => {
  t.debug('SESSION ACTIVE')
  const sid = trans.sessionData.id
  // console.log(sid, t.db.sessionData)
  t.debug('hello?')
  t.debug('sd %O', trans.sessionData)
  t.db.listenSince(0, 'change', page => {
    t.debug('page change %O', page)
    t.debug('sessionData', t.db.sessionData)
    if (page._isSession) {
      t.equal(page, t.db.sessionData)
      // check that this is me!
      t.end()
    }
  })
  // })
})

test.multi({client: true, proxy: true, ws: true}, 'session data proxy simple', async (t) => {
  const flag = await t.db.waitForSessionProperty('_isSession')
  t.ok(flag)
  t.end()
})


// try connecting twice to the same server, while allowing client
// session key storage, and see if sessions properties carry through.
