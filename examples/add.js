const dp = require('datapages')

// private session thing....?
const db = new dp.DB({serverAddress: 'ws://localhost:6001',
                      sessionPath:'addsess'})

const obj = {}
obj[process.argv[2]] = process.argv[3]
db.add(obj)
setTimeout(() => db.close(), 100)
