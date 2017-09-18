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
    const page = this.get(delta.targetLocalID, page => {
      this.emit('appear', page)
    })
    let value = this.fromRef(delta.value)
    page[delta.key] = value
    this.emit('changed', page, delta)
    // also emit via the page, by making it an EE?
    debug('applyDelta resulted in %o', page)
  }

  // return the page for this numberic id
  //
  // if there wasn't one it is created
  //
  get (id, ifCreated) {
    let page = this.pages.get(id)
    if (page === undefined) {
      page = { __localID: id }
      this.pages.set(id, page)
      if (ifCreated) ifCreated(page)
    }
    return page
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
    value = this.toRef(value)

    if (typeof value === 'function') {
      throw Error(`can't serialize function property ${key} of obj ${targetLocalID}`)
    }

    this.conn.send('delta', {targetLocalID, key, value})
  }

  /*
    Given some value, return something we can transmit to indicate
    that value, allowing for object references and loops.

    DOES NOT support circular structures made of ONLY ARRAYS.  That is:
    a = [1,2,a] will cause an infinite loop here.  Don't do that.
  */
  toRef (value) {
    debug('toRef(%j)', value)
    if (typeof value !== 'object') return value
    if (value === null) return value

    if (Array.isArray(value)) {
      const result = value.map(this.toRef.bind(this))
      debug('... = %j (array)', result)
      return result
      /*
      // copy array, running each element through toRef
      const out = []
      for (let i = 0; i < value.length; i++) {
        out.push(this.toRef(value[i]))
      }
      return out
      */
    }

    // must be normal JS object; replace it with a reference to its id

    if (!value.__localID) {
      // this ends up recursing through the graph of connected
      // objects, because add() ends up calling us back here in
      // sendProperty() on each of its properties, but it's okay
      // because __localID serves to paint an object as DONE and
      // avoid looping.
      this.add(value)
    }
    const result = {ref: value.__localID}
    debug('... = (%j) (obj)', result)
    return result
  }

  fromRef (value) {
    if (typeof value !== 'object') return value
    if (value === null) return value

    if (Array.isArray(value)) {
      return value.map(this.fromRef.bind(this))
    }
    return this.get(value.ref)
  }

  close () {
    return this.conn.close()
  }
}

module.exports.DB = DB
