'use strict'

const datapages = require('datapages')

const dps = new datapages.Server({db: new datapages.FlatFile('dog-data.csv'),
  port: process.env.PORT || 1954,
  doOwners: true
})

dps.db.on('change', (page, delta) => {
  console.log('page changed %o', delta)
})
