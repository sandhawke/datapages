const dp = require('datapages')

// private session thing....?
const db = new dp.DB({serverAddress: 'ws://localhost:6001',
  sessionPath: 'addsess'})

db.on('stable', () => {
  for (let entry of db.entries()) {
    console.log(entry[1])
  }
  db.close()
})
