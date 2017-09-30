'use strict'

// const IDMapper = require('./idmapper')
const debugM = require('debug')
const webgram = require('webgram')

let instanceCounter = 0

class Server {
  constructor (options) {
    Object.assign(this, options)
    
    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_server_' + this.debugName)

    if (!this.transport) {
      this.transport = new webgram.Server(options)
    }

    this.transport.on('create', (conn, ...args) => {
      this.debug('heard create %o from %o', args, conn.sessionData._sessionID)
      conn.send('create-ok')
    })
  }

  // We used to subclass webgram.Server, but then I wanted to make the
  // transport plugable for easier testing
  
  on (...args) {
    return this.transport.on(...args)
  }
  once (...args) {
    return this.transport.once(...args)
  }
  off (...args) {
    return this.transport.off(...args)
  }
  send (...args) {
    return this.transport.send(...args)
  }
  ask (...args) {
    return this.transport.ask(...args)
  }
  close (...args) {
    return this.transport.close(...args)
  }
  // start, stop?
  
}

module.exports.Server = Server
