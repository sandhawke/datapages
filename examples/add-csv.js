'use strict'

const dp = require('datapages')
const dsv = require('d3-dsv')
const fs = require('fs')

// const db = new dp.Remote({serverAddress: 'ws://magrathea:1978'})

const filename = 'sheet.csv'
const input = fs.readFileSync(filename, 'utf8')

const output = dsv.csvParse(input)

for (const record of output) {
  for (const prop of Object.keys(record)) {
    if (record[prop] === '') delete record[prop]
  }
  const bak = record.time
  record.time = new Date(record.time)
  if (isNaN(record.time)) {
    const dt = bak.slice(0,10) + 'T' + bak.slice(11) + ':00Z'
    // console.log('trying', dt)
    record.time = new Date(dt)
  }
  if (isNaN(record.time)) {
    console.log('bad date', bak)
  }

  console.log(record)
  // db.create(record)
}

// db.close()

// on save?  at least on-sent?
// setTimeout(() => db.close(), 1000)
