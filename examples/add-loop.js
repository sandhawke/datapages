const dp = require('datapages')

const db = new dp.DB({serverAddress: 'ws://localhost:6001',
  sessionPath: 'addsess'})

const aubrey = {}
const cassia = {}

aubrey.name = 'Aubrey'
aubrey.age = 15
aubrey.sister = cassia

cassia.name = 'Cassia'
cassia.age = 13
cassia.sister = aubrey

db.add(aubrey)  // adds cassia because it has to

setTimeout(() => db.close(), 100)
