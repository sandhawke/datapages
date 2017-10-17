'use strict'

const InMem = require('./inmem')
const RawClient = require('./client')

class Remote extends InMem {
  constructor (options) {
    super()
    this.rawClient = new RawClient(options)
    this.myBridge = this.bridge(this.rawClient)
  }

  applyDelta (delta) {
    // put our sessionID in asap, so local code can stop caring if
    // this delta is from local or remote.
    if (delta.who === undefined) delta.who = this.sessionID
    return super.applyDelta(delta)
  }
  
  get sessionID () {
    return this.rawClient.transport.sessionData.id
  }
  
  // make this async, waiting for sessionActive
  // OR make it an empty proxy, with values that get filled it?
  // that's harder
  get sessionData () {
    // Find the page which is our proxy for the session data; this
    // should already exist because the server immediately sends a
    // delta on this when the connection starts.
    let r = this.rawClient.transport.sessionData
    r = this.myBridge.reach(this.rawClient, this, r.id)
    this.debug('returning sessionData', r)
    return r
  }

  proxyFor (id) {
    // I *think* reach can & should MAKE IT if it doesn't exist yet
    const res = this.myBridge.reach(this.rawClient, this, id)
    this.debug('proxy for %d is %o', id, res)
    return res
  }

  async waitForSessionProperty (prop, timeout) {
    await this.rawClient.waitForSession()
    const id = this.rawClient.transport.sessionData.id
    const val = await this.rawClient.waitForProperty(id, prop, timeout)
    if (val === undefined) return undefined
    
    this.debug('raw sessionProperty value', val)
    return val

    // TODO
    // for refs/arrays
    // const res = this.myBridge.reach(this.rawClient, this, val)
    // this.debug('returning sessionProperty', res)
    // return res
  }

  waitForSession () {
    return this.rawClient.waitForSession()
  }
  
  close () {
    return this.rawClient.close()
  }
}

module.exports = Remote
