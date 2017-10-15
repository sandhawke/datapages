'use strict'

const InMem = require('./inmem')
const RawClient = require('./client')

class Remote extends InMem {
  constructor (options) {
    super()
    this.rawClient = new RawClient(options)
    this.myBridge = this.bridge(this.rawClient)
  }
  
  get sessionData () {
    // Find the page which is our proxy for the session data; this
    // should already exist because the server immediately sends a
    // delta on this when the connection starts.
    let r = this.rawClient.transport.sessionData
    // r = this.myBridge.reach(this.rawClient, this, r._sessionID)
    this.debug('returning sessionData', r)
    return r
  }

  close () {
    return this.rawClient.close()
  }
}

module.exports = Remote
