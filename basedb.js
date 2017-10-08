'use strict'

/*
  Parent class (abstract base class) for all the DB classes, with some
  convienience functions.
*/

const EventEmitter = require('eventemitter3')
const Bridge = require('./bridge')
const View = require('./view')
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

    // we just care about the delta, but some simpler software mostly
    // just wants to be handled the delta.subject, so ... give it that
    // with on('change')
    this.on('delta', delta => {
      this.debug('delta => change %o', delta)
      this.emit('change', delta.subject, delta)
    })
  }

  close () { }

  bridge (other) {
    return new Bridge(this, other)
  }

  view (options) {
    return new View(options, this)
  }

  setProperty (subject, property, value, who, when) {
    const delta = {subject, property, value, who, when}
    this.applyDelta(delta)
  }

  create (overlay) {
    const id = this.createBlank()
    if (overlay) {
      this.overlay(id, overlay)
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
}

DB.prototype[Symbol.iterator] = function * () {
  yield * this.items()
}

module.exports = DB
