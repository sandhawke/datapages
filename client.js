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
      delta.when = new Date(delta.when)
      this.emit('delta', delta)
    })
  }

  close () {
    this.transport.close()
  }

  createBlank () {
    const id = this.nextLocalID--
    this.debug('create returning', id)
    return id
  }

  listenSince (seq, name, cb) {
    this.on('change', cb)
    this.transport.send('subscribe', 'all', seq)
  }

  applyDelta (delta) {
    delta.value = this.refs.to(delta.value)
    this.debug('sending delta %o', delta)
    this.transport.send('delta', delta)
  }
}

module.exports = Client
