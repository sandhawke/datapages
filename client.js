'use strict'


const EventEmitter = require('eventemitter3')
const webgram = require('webgram')
const debugM = require('debug')
// const debug = require('debug')('datapages_client')

let instanceCounter = 0

class Client extends EventEmitter {
  constructor (options = {}) {
    super()
    Object.assign(this, options)

    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_client_' + this.debugName)

    if (!this.transport) {
      this.transport = new webgram.Client(this.serverAddress, options)
    }

    this.transport.on('create-ok', () => {
      this.debug('heard create-ok')
    })
  }

  create () {
    this.debug('create')
    this.transport.send('create', 'foo')
  }

  close () {
    this.transport.close()
  }
}

/*
    this.nextID = -1
    this.deltas = []
    this.pages = new Map()
    this.views = {}

    if (!this.localMode) {
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

      // this is for current dumb (send-everything) datapage server
      this.conn.send('subscribe', { since: 0 })
    }
  }

  applyDeltaLocally (delta) {
    debug('applyDeltaLocally %o', delta)
    const page = this.get(delta.targetLocalID, page => {
      debug('new page, emitting appear')
      this.emit('appear', page)
    })
    delta.__target = page
    let value = this.fromRef(delta.value)
    page[delta.key] = value
    this.emit('change', page, delta)
    // also emit via the page, by making it an EE?
    debug('applyDelta resulted in %o', page)
  }

  onSince (id, event, func) {
    // ignore id for now.   you'll get some extra replayed events/objects.
    //
    // how to make this work right for views?
    //
    // Buffer any new events that might occur during replay.  Even
    // though this is synchronous code, the callbacks we're calling
    // might trigger more events.
    const buffer = []
    const addToBuffer = (...args) => {
      buffer.push(args)
    }
    this.on(event, addToBuffer)

    if (event === 'appear') {
      for (const page of this) {
        func(page)
      }
    } else if (event === 'change') {
      for (const delta of this.deltas) {
        func(delta)
      }
    } else {
      throw Error(`unexpected onSince event name "${event}"`)
    }

    while (buffer.length) {
      const args = buffer.shift()
      func(...args)
    }

    this.on(event, func)
  }

  // return the page for this numberic id
  //
  // if there wasn't one it is created, unless ifCreated === false
  // if one is created, ifCreated is called (if truthy)
  get (id, ifCreated) {
    let page = this.pages.get(id)
    if (page === undefined && ifCreated !== false) {
      page = { __localID: id }
      this.pages.set(id, page)
      if (ifCreated) ifCreated(page)
    }
    return page
  }

  // make this also @@iterator ?
  items () {
    return this.pages.values()
  }

  /*
  entries () {   // deprecated
    return this.pages.entries()
  }
  *./

  /*
     maybe options, or variations?

     like:

     .proxy() / .create() which returns a new live proxy that
     auto-overlays.

     or a version that uses Object.defineProperty( ) to set a setter
     on all the current properties, so at least those get trapped?

  *./
  async add (page) {
    if (page.__localID) throw Error('page already has __localID')
    const targetLocalID = this.nextID--
    page.__localID = targetLocalID
    this.pages.set(targetLocalID, page)
    if (this.localMode) {
      this.emit('appear', page)
    }
    const all = []
    for (let key of Object.keys(page)) {
      all.push(this.sendProperty(page, key, page[key]))
    }
    debug('waiting for all sendProperties')
    await Promise.all(all)
    debug('all sendProperties resolved')
  }

  async overlay (page, overlay) {
    const targetLocalID = page.__localID
    if (!targetLocalID) throw Error('you can only overlay pages with IDs')
    for (let key of Object.keys(overlay)) {
      // also set it locally?  I dunno!

      // factor this out with add, and don't use await like this
      await this.sendProperty(page, key, overlay[key])
    }
  }

  async sendProperty (page, key, value) {
    if (key.startsWith('__')) return
    const targetLocalID = page.__localID
    value = this.toRef(value)

    if (typeof value === 'function') {
      throw Error(`can't serialize function property ${key} of obj ${targetLocalID}`)
    }

    const delta = {targetLocalID, key, value}
    if (this.localMode) {
      this.deltas.push(delta)
      this.applyDeltaLocally(delta)
    } else {
      await this.conn.ask('delta', delta)
    }
    debug('delta confirmed')
  }

  /*
    Given some value, return something we can transmit to indicate
    that value, allowing for object references and loops.

    DOES NOT support circular structures made of ONLY ARRAYS.  That is:
    a = [1,2,a] will cause an infinite loop here.  Don't do that.
  *./
  toRef (value) {
    debug('toRef(%j)', value)
    if (typeof value !== 'object') return value
    if (value === null) return value

    if (value.toISOString) {
      debug('serializing Date')
      return {iso8601: value.toISOString()}
    }

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
      *./
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
    if (value.iso8601) {
      debug('deserializing date')
      return new Date(value.iso8601) // is there a better iso parser? joda?
    }
    return this.get(value.ref)
  }

  close () {
    return this.conn.close()
  }

  /*
  filter (f) {
    return this.view({filter: f}, this)
  }
  *./

  view (arg) {
    debug('db creating new view from %o', arg)
    if (!arg.name) {
      arg.name = 'auto_' + viewAutoNameCount++
    }
    debug('new view named %j', arg.name)
    const v = new View(arg, this)
    this.views[arg.name] = v
    this.emit('view-added', v)

    if (!this.localMode) {
      // this is for different protocol, implemented by socdb server at
      // the moment
      this.conn.send('view-start', arg)
    }

    return v
  }
}
*/
Client.prototype[Symbol.iterator] = Client.prototype.items

module.exports.Client = Client
