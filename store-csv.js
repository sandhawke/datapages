'use strict'

// Just implements the PRIMITIVE interface: on-change, on-save,
// create(no args), listenSince, setProperty
//
// If you want more, or caching, bridge it to InMem

const EventEmitter = require('eventemitter3')
const debugM = require('debug')
const fs = require('fs')
const parse = require('csv-parse')
const stringify = require('csv-stringify')

let instanceCounter = 0

class StoreCSV extends EventEmitter {
  constructor (filename, options = {}) {
    super()
    Object.assign(this, options)

    this.filename = filename
    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_store_csv_' + this.debugName)

    this.str = stringify()

    this.nextID = undefined // these count up from max in file
    this.nextTempID = -1    // these count DOWN, -1, -2, -3, ...

    this.fileA = fs.openSync(this.filename, 'a')

    this.firstListenStarted = false
    this.firstListenEnded = false
    this.maxSubjectIDSeen = 0
    this.maxDeltaIDSeen = 0
  }

  /*
    Return a new handle for an object; that's all we really have to
    do.  We use numbers.

    To make this synchronous before boot() has resolved, we have to do
    the temp-id trick.  Probably silly for this module, but it's
    definitely a trick we want for network usage.
  */
  create () {
    let id = this.nextID
    if (id) {
      this.nextID++
    } else {
      this.debug('create() before learning nextID, using temp')
      id = --this.nextTempID
    }
  }

  /*
    Read the file, streaming out the deltas
  */
  listenSince (seq, name, cb) {
    if (name !== 'change') throw Error('only "change" events implemented in listenSince')

    const first = !this.firstListenStarted
    this.firstListenStarted = true

    const parser = parse()
    const input = fs.createReadStream(this.filename);
    const sink = new EventEmitter()
    sink.write = (delta) => {
      this.maxSubjectIDSeen = Math.max(this.maxSubjectIDSeen, delta.subject)
      this.maxDeltaIDSeen = Math.max(this.maxDeltaIDSeen, delta.seq)
      cb(delta.subject, delta)
    }
    sink.end = () => {
      if (first) {
        this.nextCreate = this.maxSubjectSeenID + 1
        this.nextDelta = this.maxDeltaSeenID + 1
        this.firstListenEnded = true
        this.emit('booted')
      }

      // in theory, things might be in the output pipeline and we'd
      // miss them.  Have them in a being-written buffer?
      
      this.emit('stable')  // replay-done?
      this.debug('done')
      input.close()
    }

    input.pipe(parser).pipe(sink)
  }

  boot () {
    return new Promise((resolve, reject) => {
      if (this.firstListenEnded) resolve()
      this.on('booted', resolve)
      // let someone who's going to use the data go first
      process.nextTick(() => {
        if (this.firstListen) {
          this.listenSince(0, 'change', () => null)
        }
      })
    })
  }
  
  // which is better? 
  // async applyDelta(delta) {
  //     let {subject, property, value, who, when} = delta

  async setProperty (subject, property, value, who, when) {
    if (subject < 0) {
      await this.boot()
      subject = await this.permID(subject)
    }
    const seq = ++this.seq

    const delta = {subject, property, value, who, when}
    const record = [subject, property, value, who, when]
    stringify([record], (err, output) => {
      this.debug('csv: ', output)
      // // FOR NOW use filename, so it's closed immediately
      fs.appendFile(this.fileA, output, {encoding: 'utf8'}, (err) => {
        if (err) throw err
        this.emit('save', delta, { filename: this.filename })
      })
    })
    this.emit('change', delta.subject, delta)
  }
}

module.exports.StoreCSV = StoreCSV
