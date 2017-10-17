'use strict'

const webgram = require('webgram')
const refs = require('./refs')
const debugM = require('debug')
const BaseDB = require('./basedb')

let instanceCounter = 0

class Client extends BaseDB {
  constructor (options = {}) {
    super()
    Object.assign(this, options)

    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_client_' + this.debugName)

    this.refs = refs(this.create.bind(this), this.overlay.bind(this))

    this.nextLocalID = -1 // COUNTING -1, -2, -3 ...

    if (!this.transport) {
      this.transport = new webgram.Client(this.serverAddress, options)
    }

    this.transport.on('delta', delta => {
      this.debug('heard delta %o', delta)
      delta.value = this.refs.from(delta.value)
      if (delta.when) delta.when = new Date(delta.when)
      this.emit('delta', delta)
    })
  }

  waitForSession () {
    return this.transport.waitForSession()
  }
  
  close () {
    // maybe: this.transport.onError = (err) => 
    // Nope, it's a reject :
    try {
      this.transport.close()
    } catch (err) {
      console.log('# ignoring client err in close(): ', err.message)
    }
  }

  createBlank () {
    const id = this.nextLocalID--
    this.debug('create returning', id)
    return id
  }

  listenSince (seq, name, cb) {
    this.on(name, cb)
    this.transport.send('subscribe', 'all', seq)
  }

  applyDelta (delta) {
    delta.value = this.refs.to(delta.value)
    this.debug('sending delta %o', delta)
    this.transport.send('delta', delta)
  }
}

module.exports = Client
