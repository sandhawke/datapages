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
    page[delta.key] = delta.value
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
      if (key.startsWith('__')) continue
      let value = page[key]
      this.conn.send('delta', {targetLocalID, key, value})
    }
  }

  overlay (page, overlay) {
    const targetLocalID = page.__localID
    if (!targetLocalID) throw Error('you can only overlay pages with IDs')
    for (let key of Object.keys(overlay)) {
      if (key.startsWith('__')) continue
      let value = overlay[key]
      this.conn.send('delta', {targetLocalID, key, value})
    }
  }

  close () {
    return this.conn.close()
  }
}

module.exports.DB = DB
