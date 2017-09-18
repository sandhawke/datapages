const dp = require('datapages')

// private session thing....?
const db = new dp.DB({serverAddress: 'ws://localhost:6001',
  sessionPath: 'addsess'})

const argv = process.argv
if (argv.length !== 5) { throw Error('need three arguments') }
argv.shift()
argv.shift()
const id = parseInt(argv.shift())
const key = argv.shift()
const value = argv.shift()

const obj = { __localID: id }
const overlay = {}
overlay[key] = value
db.overlay(obj, overlay)

setTimeout(() => db.close(), 100)
