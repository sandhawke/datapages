'use strict'

/*
  Parent class (abstract base class) for all the DB classes, with some
  convienience functions.
*/

const EventEmitter = require('eventemitter3')
const Bridge = require('./bridge').Bridge
const debugM = require('debug')

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
  }

  close () { }

  bridge (other) {
    return new Bridge(this, other)
  }

  setProperty (subject, property, value, who, when) {
    const delta = {subject, property, value, who, when}
    this.applyDelta(delta)
  }

  // create = createBlank + overlay

  // setProperty

  // overlay

  // @@iterator, items as generated for items, gathered from deltas

  // delete as _deleted = true
}

module.exports = DB
