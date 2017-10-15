'use strict'

const Server = require('./server')

const RawClient = require('./client')
const InMem = require('./inmem')
const FlatFile = require('./flatfile')
const MinDB = require('./mindb')

class Remote extends InMem {
  constructor (options) {
    super()
    this.rawClient = new RawClient(options)
    this.bridge(this.rawClient)
  }
  
  get sessionData () {
    return this.rawClient.transport.sessionData
  }

  close () {
    return this.rawClient.close()
  }
}

module.exports = { InMem, FlatFile, MinDB, RawClient, Server, Remote }
