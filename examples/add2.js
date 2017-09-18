const dp = require('datapages')

// private session thing....?
const db = new dp.DB({serverAddress: 'ws://localhost:6001',
  sessionPath: 'addsess'})

let obj = { copy: 1 }
obj[process.argv[2]] = process.argv[3]
obj[process.argv[4]] = process.argv[5]
db.add(obj)

obj = { copy: 2 }
obj[process.argv[2]] = process.argv[3] + '_2'
obj[process.argv[4]] = process.argv[5] + '_2'
db.add(obj)

setTimeout(() => db.close(), 100)
