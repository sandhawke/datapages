const dp = require('datapages')

// private session thing....?
const db = new dp.DB({serverAddress: 'ws://localhost:6001'})

db.on('appear', p => {
  console.log('page appeared %o', p)
})

db.on('changed', (page, delta) => {
  console.log('page changed page=%o', page)
  console.log('  delta=%o', delta)
})

