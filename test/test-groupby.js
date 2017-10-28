'use strict'

const test = require('./setup')

test.multi({proxy: true, only: 'inmem'}, 'simple group by', async (t) => {
  const v = t.db.view({
    filter: {},
    groupBy: 'breed'
  })
  const d1 = t.db.create({breed: 'Akita', name: 'Taiko'})
  const d2 = t.db.create({breed: 'Akita', name: 'Tsuzumi'})
  const d3 = t.db.create({breed: 'Great Dane', name: 'Mako'})
  const d4 = t.db.create({breed: 'Samoyed', name: 'Fish'})
  await t.sleep(1)
  t.deepEqual(v.groupsObject, {
    Akita: [ d1, d2 ],
    'Great Dane': [ d3 ],
    'Samoyed': [ d4 ]
  })
  t.end()
})
