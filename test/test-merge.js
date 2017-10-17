'use strict'

/*
    Oh, inmem nesting isn't working

    Without that, we could still do 1-key...

    Oh huh, no wait.
    
    What exactly are we smushing?   on creativeWork.title + creativeWork.year
    ?

*/

const test = require('tape')
const debug = require('debug')('datapages_test_merge')
const datapages = require('..')

function addAvengers (db) {
  // for one of them the creativeWork will be the same object, for
  // the other, it will only have the same attributes, so it will
  // have to be merged
  const a98 = db.create({ title: 'The Avengers', year: 1998, boxOfficeMUSD: 48 })
  const data = [
    { creativeWork: { title: 'The Avengers', year: 2012, boxOfficeMUSD: 1519 },
      character: { name: 'Black Widow ' },
      actor: { name: 'Scarlett Johansson' }
    },
    { creativeWork: { title: 'The Avengers', year: 2012 },
      character: { name: 'Hulk' },
      actor: { name: 'Mark Ruffalo' }
    },
    { creativeWork: a98,
      character: { name: 'Emma Peel' },
      actor: { name: 'Uma Thurman' }
    },
    { creativeWork: a98,
      character: { name: 'John Steed' },
      actor: { name: 'Ralph Fiennes' }
    },
  ]
  for (const d of data) {
    db.create(data)
  }
}

test(t => {
  const db = new datapages.InMem()
  db.on('delta', delta => {
    debug('delta:', delta)
  })
  addAvengers(db)
  const v = db.view({filter: {}})
  // const m = v.merge(['title', 'year'])
  const r = Array.from(v.members)
  t.deepEqual(r, ['x'
  ])
  t.end()
})
