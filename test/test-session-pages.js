'use strict'

const datapages = require('..')
const test = require('tape')

test(async (t) => {
  const tmp = fs.mkdtempSync('/tmp/datapages-test-')

  
  const dps = new datapages.Server({db: new datapages.MinDB(),
                                    doOwners: true
                                   })
  dps.db.on('change', (page, delta) => {
    console.log('page changed %o', delta)
  })
  
  const server = dps.transport
  await server.start()

  

})
