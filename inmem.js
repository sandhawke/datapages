'use strict'

/*
  needs:   proxies via  .proxy, and on-appear
     so that on-appear is actually useful
*/

const EventEmitter = require('eventemitter3')
const debugModule = require('debug')
const setdefault = require('setdefault')
const util = require('util')
// const View = require('./view')

// let viewAutoNameCount = 0

let dbseq = 0

class InMem extends EventEmitter {
  constructor (options = {}) {
    super()
    Object.assign(this, options)

    if (!this.name) this.name = '' + ++dbseq
    this.debug = debugModule('datapages_db_' + this.name)
    this.objCount = 0

    // this.nextID = -1
    this.deltas = []
    // this.rawpages = new Map()   // by id
    // this.proxies = new Map() // by id
    // this.views = {}
    this.ee = Symbol('myEventEmitter')
    this.maxSeqUsed = 0

    this.debug('constructed')
  }

  inspect () {
    return `InMem(${this.name})`
  }

  listenSince (seq, event, func) {
    this.debug('new listener')
    if (event === 'change') {
      for (const delta of this.deltas) {
        if (delta.seq > seq) {
          func(delta.subject, delta)
        }
      }
      // is it possible to lose any in this gap?  If the func ads
      // more, will it see them?  see test replayGap
      this.debug('replay compelte, adding directly')
      this.on('change', func)
    }
  }

  /*
    Create a new proxy, setting its values according to the
    overlay, and return it.  Proxies can be watched for on-change and
    on-save, and when you change them, they automatically start
    propagating the new value.  Because you can watch for 'save', we
    return synchronously.
   */
  create (overlay) {
    if (!this.handler) {
      this.handler = {
        get: this.proxyHandlerForGet.bind(this),
        set: this.proxyHandlerForSet.bind(this)
      }
    }
    const rawpage = { __rawseq: ++this.objCount }
    // this.debug('rawpage 1 %o', rawpage)
    const proxy = new Proxy(rawpage, this.handler)
    // this.debug('rawpage 2 %o', rawpage)
    // rawpage.__proxy = proxy
    // this.debug('rawpage 3 %o', rawpage)
    if (overlay) this.overlay(proxy, overlay)
    this.debug('created %o', proxy)
    return proxy
  }

  delete (proxy) {
    this.setProperty(proxy, '_deleted', true)
    this.emit('disappear', proxy)
    // and hope people release their pointers

    // and maybe have some code throw stuff if you access it?
  }

  /*
    Set a bunch of values at once

    Return a promise of them all being saved...?
  */
  overlay (proxy, overlay) {
    for (let key of Object.keys(overlay)) {
      this.setProperty(proxy, key, overlay[key])
    }
  }

  proxyHandlerForGet (target, name, receiver) {
    // this.debug('GET NAME', name)
    // this.debug('handling GET %j on data %o', name, target)
    if (target._deleted) throw Error('accessing deleted object')
    // if (receiver !== target.__proxy) throw Error('unexpected proxy receiver value')

    if (name === util.inspect.custom || name === 'inspect') {
      return () => 'Proxy_' + this.name + '_' + target.__rawseq
    }
    if (name === '__target') {
      return target
    }
    if (name === 'on' || name === 'off' || name === 'once') {
      // "this.ee" is the symbol we use to attach this object's EventEmitter,
      // which we only create when it's first used
      const ee = setdefault.lazy(target, this.ee, () => new EventEmitter())
      return ee[name].bind(ee)
    } else {
      return target[name]
    }
  }

  emit (name, ...args) {
    super.emit(name, ...args)
    // ALSO emit the on the pg itself, it it has its own event emitter
    if (name === 'change' || name === 'appear' || name === 'disappear') {
      const pg = args[0]
      const ee = pg.__target[this.ee]
      if (ee) ee.emit(name, ...args)
    }
  }

  proxyHandlerForSet (target, name, value, receiver) {
    this.debug('handling SET .%j=%o  on data %o', name, value, target)
    if (target._deleted) throw Error('accessing deleted object')
    // if (receiver !== target.__proxy) throw Error('unexpected proxy receiver value')
    this.setProperty(receiver, name, value)
    return true
  }

  setProperty (proxy, name, value) {
    this.debug('setProperty %o %j=%j', proxy, name, value)
    const target = proxy.__target
    this.debug('  target is %o', target)

    // WISH LIST: check that the value is allowed by all our async Validators

    const oldValue = target[name]
    if (oldValue === value) {
      this.debug('change to same value?')
      return
    }
    if (value === undefined) {
      delete target[name]   // we don't deal with inheritence, so this is simpler
    } else {
      target[name] = value
    }
    const seq = ++this.maxSeqUsed
    // BUG: if this subject: proxy we get a loop
    const delta = { subject: proxy, property: name, oldValue, value, seq }
    this.deltas.push(delta)
    this.debug('emiting %d delta %o', seq, delta)
    this.emit('change', proxy, delta)
    this.debug('emit done %d', seq)
  }

  /// /////////////////////////////////////////////////////////////

  /*
  applyDeltaLocally (delta) {
    debug('applyDeltaLocally %o', delta)
    const page = this.get(delta.targetLocalID, page => {
      debug('new page, emitting appear')
      this.emit('appear', page)
    })
    delta.__target = page
    let value = this.fromRef(delta.value)

    /*
      UNCLEAR how this is supposed to work with NEW OBJECTS

    const oldValue = page[delta.key]
    if (delta.oldValue) {
      if (oldValue !== delta.oldValue) throw Error('rigid delta fails')
    }
    delta.oldValue = oldValue
    *./

    page[delta.key] = value
    this.emit('change', page, delta)
    // also emit via the page, by making it an EE?
    debug('applyDelta resulted in %o', page)
  }

  replayAfter (seq, event, func) {
    // ignore seq for now.   you'll get some extra replayed events/objects.
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
        func(delta.__target, delta)
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
    let page = this.rawpages.get(id)
    if (page === undefined && ifCreated !== false) {
      page = { __localID: id }
      this.rawpages.set(id, page)
      if (ifCreated) ifCreated(page)
    }
    return page
  }

  // make this also @@iterator ?
  //
  // Is this PROXIES or RAWPAGES ?
  //
  items () {
    return this.rawpages.values()
  }

  /*
  entries () {   // deprecated
    return this.pages.entries()
  }
  *./

  /*
    Add this specific object to this database.

    Consider using .proxy instead to make a "smart" object that easier
    to do stuff with.  .add() is necessary, however, if other folks
    have pointers to this object and you can't swap the proxy into its
    place.

    When you add an object, all linked-to objects are also added,
    recursively, if they are not already in the db.  All those
    pointers remain unchanged, === to its old value.  In contrast,
    .proxy() has to change all those pointers, replacing every object
    with its proxy.
  *./
  async add (page) {
    if (page.__localID) throw Error('page already has __localID')
    const targetLocalID = this.nextID--
    page.__localID = targetLocalID
    this.rawpages.set(targetLocalID, page)

    // I THINK WE'RE SUPPOSED TO APPEAR THE PROXY INSTEAD
    this.emit('appear', page)

    const all = []
    for (let key of Object.keys(page)) {
      all.push(this.sendProperty(page, key, page[key]))
    }
    debug('waiting for all sendProperties')
    await Promise.all(all)
    debug('all sendProperties resolved')
  }

  */

    /*

  async sendProperty (page, key, value) {
    if (key.startsWith('__')) return
    const targetLocalID = page.__localID
    value = this.toRef(value)

    if (typeof value === 'function') {
      throw Error(`can't serialize function property ${key} of obj ${targetLocalID}`)
    }

    const delta = {targetLocalID, key, value}
    this.deltas.push(delta)
    this.applyDeltaLocally(delta)
    debug('delta applied')
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
    this.emit('close')
  }

  view (arg) {
    debug('db creating new view from %o', arg)
    if (!arg.name) {
      arg.name = 'auto_' + viewAutoNameCount++
    }
    debug('new view named %j', arg.name)
    const v = new View(arg, this)
    this.views[arg.name] = v
    this.emit('view-added', v)

    this.emit('view-create', arg)
    return v
  }
  */
}

// InMem.prototype[Symbol.iterator] = InMem.prototype.items

module.exports.InMem = InMem