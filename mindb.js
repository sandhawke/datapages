'use strict'
/*

  Implements the L1 (primitive) interface in memory

  From flatfile.js stripped down

*/

const EventEmitter = require('eventemitter3')
const debugM = require('debug')

let instanceCounter = 0

class MinDB extends EventEmitter {
  constructor (filename, options = {}) {
    super()
    Object.assign(this, options)

    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_mindb_' + this.debugName)

    this.deltas = new Set()

    this.nextSubjectID = 1
    this.nextDeltaID = 1

    let nextSave = this.nextDeltaID
  }

  close () { }
  
  create () {
    let id = this.nextSubjectID++
    this.debug('create() returning %d', id)
    return id
  }

  listenSince (seq, name, cb) {
    if (name !== 'change') throw Error('only "change" events implemented in listenSince')
    this.debug('listenSince starts')
    for (const delta of this.deltas) {
      cb(delta.subject, delta)
    }
    this.debug('replay done')
    this.emit('stable')  // replay-done?
    this.on('change', cb)
    this.debug('listenSince returning')
  }

  setProperty (subject, property, value, who, when) {
    const delta = {subject, property, value, who, when}
    this.applyDelta(delta)
  }

  applyDelta (delta) {
    if (delta.seq === undefined) delta.seq = this.nextDeltaID++
    this.deltas.add(delta)
    this.emit('change', delta.subject, delta)
  }
}


module.exports = { MinDB }
