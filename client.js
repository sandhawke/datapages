'use strict'

const webgramSessions = require('webgram-sessions')
const EventEmitter = require('eventemitter3')
const debug = require('debug')('datapages:client')

class DB extends EventEmitter {
  constructor (options = {}) {
    super()
    Object.assign(this, options)
    if (!this.conn) {
      this.conn = new webgramSessions.Client(this.serverAddress, options)
    }

    this.nextID = -1
    this.deltas = []
    this.pages = new Map()

    this.conn.on('replay-complete', () => {
      debug('handling replay-complete')
      this.emit('stable')
    })

    this.conn.on('delta', delta => {
      debug('handling delta %o', delta)
      this.deltas.push(delta)
      this.applyDeltaLocally(delta)
    })

    // at some point, we could use localForage or something to retain
    this.conn.send('subscribe', { since: 0 })
  }

  applyDeltaLocally (delta) {
    const id = delta.targetLocalID
    let page = this.pages.get(delta.targetLocalID)
    if (page === undefined) {
      page = { __localID: id }
      this.pages.set(id, page)
      this.emit('appear', page)
    }
    let value = delta.value
    if (delta.type === 'ref') {
      // turn object number back into actual object
      value = this.get(value)
    }
    page[delta.key] = value
    this.emit('changed', page, delta)
    // also emit via the page, by making it an EE?
    debug('applyDelta resulted in %o', page)
  }

  get (id) {
    return this.pages.get(id)
  }

  entries () {
    return this.pages.entries()
  }

  add (page) {
    if (page.__localID) throw Error('page already has __localID')
    const targetLocalID = this.nextID--
    page.__localID = targetLocalID
    this.pages.set(targetLocalID, page)
    for (let key of Object.keys(page)) {
      this.sendProperty(page, key, page[key])
    }
  }

  overlay (page, overlay) {
    const targetLocalID = page.__localID
    if (!targetLocalID) throw Error('you can only overlay pages with IDs')
    for (let key of Object.keys(overlay)) {
      // also set it locally?  I dunno!
      this.sendProperty(page, key, overlay[key])
    }
  }

  sendProperty (page, key, value) {
    if (key.startsWith('__')) return
    const targetLocalID = page.__localID
    let type = typeof value
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // oh gosh, it depends what it's an array OF!
        throw Error('array serialization not done yet')
      } else if (value === null) {
        type = 'null'
      } else {
        if (!value.__localID) {
          // this ends up recursing through the graph of connected
          // objects, because add() ends up calling us back here in
          // sendProperty() on each of its properties, but it's okay
          // because __localID serves to paint an object as DONE and
          // avoid looping.
          this.add(value)
        }
        type = 'ref'
        value = value.__localID
      }
    }
    if (type === 'function') {
      throw Error(`can't serialize function property ${key} of obj ${targetLocalID}`)
    }

    this.conn.send('delta', {targetLocalID, key, value, type})
  }

  close () {
    return this.conn.close()
  }
}

module.exports.DB = DB
