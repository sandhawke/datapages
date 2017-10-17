'use strict'

/*
  Parent class (abstract base class) for all the DB classes, with some
  convienience functions.
*/

const EventEmitter = require('eventemitter3')
const Bridge = require('./bridge')
const refs = require('./refs')
const debugM = require('debug')

// make ourselves some find debugging labels, so this.debug tells us
// exactly which object is doing the talking
const instanceCounters = new Map()
function nextNum (type) {
  let val = instanceCounters.get(type)
  if (!val) val = 0
  val++
  instanceCounters.set(type, val)
  return val
}

class DB extends EventEmitter {
  constructor (options = {}) {
    super()
    const className = Object.getPrototypeOf(this).constructor.name
    this.debug = debugM(options.debugPrefix ||
                        `datapages_${className}_${nextNum(className)}`)

    this.refs = refs(this.create.bind(this),
                     this.overlay.bind(this))
    
    if (this.stabilityms === undefined) this.stabilityms = 10
    
    // we just care about the delta, but some simpler software mostly
    // just wants to be handled the delta.subject, so ... give it that
    // with on('change')
    this.on('delta', delta => {
      this.debug('delta => change %o', delta)
      this.emit('change', delta.subject, delta)

      // It's intentional that we don't start the timer until the
      // first delta.  Typically we don't want to display zero results
      // quickly while loading the initial set.  If you want that,
      // just call your on-stable function at creation time.
      if (this.listeners('stable').length) {
        this.debug('someone is listening for on-stable! %O', this.listeners('stable').toString())
        // I wonder how much this affects performance?  Dunno the
        // overhead for clearTimeout and setTimeout.
        if (this.timeout !== undefined) clearTimeout(this.timeout)
        this.timeout = setTimeout(() => {
          this.debug('stability timeout running')
          this.emit('stable', this, delta)
        }, this.stabilityms)
        this.debug('set a timeout for %nms', this.stabilityms)
      }
    })
  }

  get emitsChange () { return true }
  get emitsStable () { return true }
  
  close () { }

  bridge (other) {
    return new Bridge(this, other)
  }

  /*
    Conceptually this is here, but to avoid circularity we actualy
    patch this in from view.js

  view (options) {
    return new View(options, this)
  }
  */

  setProperty (subject, property, value, who, when) {
    const delta = {subject, property, value}
    // we don't want { who: undefined } cluttering up our test cases, etc
    if (who !== undefined) delta.who = who
    if (when !== undefined) delta.when = when

    delta.value = this.shred(delta.value)
    this.applyDelta(delta)
  }

  createBlank () {
    throw Error('subclass needs to implement createBlank method')
  }
  
  applyDelta () {
    throw Error('subclass needs to implement applyDelta method')
  }
  
  create (overlay, who, when) {
    const id = this.createBlank()
    if (overlay) {
      this.overlay(id, overlay, who, when)
    }
    return id
  }

  overlay (subject, overlay, who, when) {
    for (const key of Object.keys(overlay)) {
      if (key.startsWith('__')) continue
      this.setProperty(subject, key, overlay[key], who, when)
    }
  }

  delete (subject) {
    this.setProperty(subject, '_deleted', true)
  }

  // built on .on('change', ...) and .replaySince(...)
  async listenSince (seq, ev, fn) {
    if (ev !== 'change') throw Error('can only listenSince for "change" events')
    let buf = []
    this.debug('adding change listener')
    this.on('change', (pg, delta) => {
      if (buf) {
        buf.push(delta)
      } else {
        this.debug('calling listenSince listener without buffering')
        fn(pg, delta)
      }
    })

    this.debug('listenSince STARTING REPLAY')
    await this.replaySince(seq, ev, fn)
    this.debug('listenSince resuming after replaySince')

    // loop as long as we need to, since fn might trigger more events
    while (buf.length) {
      const delta = buf.shift()
      this.debug('calling listenSince with buffered event')
      fn(delta.subject, delta)
    }
    buf = false // flag to stop buffering
    this.emit('stable')
  }

  shred (value) {
    return this.refs.to(value)
  }

  waitForProperty (subject, property, timeout) {
    const that = this
    let timer = null
    return new Promise(resolve => {
      function func (pg, delta) {
        that.debug('waitForProperty check delta %o', delta)
        if (delta.subject === subject && delta.property === property) {
          timeout = null // so the timer never gets set, if it hasn't been yet
          if (timer !== null) clearTimeout(timer)
          that.debug('timer canceled')
          resolve(delta.value)  // TODO output refs.from 
          that.off('change', func)
        }
      }
      this.listenSince(0, 'change', func)
      if (timeout !== null) {
        if (timeout === undefined) timeout = 10000
        timer = setTimeout(() => {
          that.debug('timeout waiting %dms for %j', timeout, property)
          this.off('delta', func)
          resolve(undefined)
        }, timeout)
        that.debug('timer is', timer)
        // we can't do this without having tests return too soon & fail:
        // if (timer.unref) timer.unref() // nodejs don't keep alive
      }
    })
  }
}

/* Not sure why this doesn't work; for now we only need it on View anyway,
   so it's there, without inheritance 

DB.prototype[Symbol.iterator] = function () {
  return this.items()
}
*/

module.exports = DB
