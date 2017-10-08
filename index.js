'use strict'

const Server = require('./server')

const RawClient = require('./client')
const InMem = require('./inmem')
const FlatFile = require('./flatfile')
const MinDB = require('./mindb')

class Remote extends InMem {
  constructor (options) {
    super()
    const client = new RawClient(options)
    this.bridge(client)
  }
}

module.exports = { InMem, FlatFile, MinDB, RawClient, Server, Remote }
