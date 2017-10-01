'use strict'

// Just implements the PRIMITIVE interface: on-change, on-save,
// create(no args), listenSince, setProperty
//
// If you want more bridge it to InMem
//
//
// There was kinda-working async, no-storage version of this at
// https://github.com/sandhawke/datapages/blob/64432ceb79d46ecae85acd4ba709028f973766d8/store-csv.js
// before I deciding simplicity was much more important
// than performance (for now)

const EventEmitter = require('eventemitter3')
const debugM = require('debug')
const fs = require('fs')
const d3 = require('d3-dsv')
// async wtf const stringify = require('csv-stringify')
// async wtf const parse = require('csv-parse') 
// const CSV = require('csv-string') 

let instanceCounter = 0

class StoreCSV extends EventEmitter {
  constructor (filename, options = {}) {
    super()
    Object.assign(this, options)

    this.filename = filename
    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_store_csv_' + this.debugName)

    this.fileA = fs.openSync(this.filename, 'a')
    this.debug('file descriptor', this.fileA)

    // I don't like buffering them, but for now it makes the replay
    // logic simpler, with no risk that we'll drop deltas that are
    // being added while listenSince is doing its replay.
    this.deltas = new Set()

    this.writeHeader = true
    this.boot()

    let nextSave = this.nextDeltaID
    this.on('save', (delta, details) => {
      if (nextSave !== delta.seq) {
        throw Error('bad sequence of saves ' + nextSave + ' --- ' + delta.seq)
      }
      nextSave++
    })
  }

  close () {
    fs.closeSync(this.fileA)
    this.fileA = null
  }
  
  boot () {
    this.debug('booting')
    const input = fs.readFileSync(this.filename, 'utf8');
    this.debug('input as %d chars', input.length)
    let maxS = 0
    let maxD = 0
    const output = d3.csvParse(input)
    this.debug('parsed whole as %O', output)
    /*
    if (output.length === 1 && output[0].length === 1 && output[0][0] === '') {
      this.debug('workout bug in CSV, for empty input returns [[""]]')
      output.shift()
    }
    */
    // this.debug('parsed whole as %O', output)
    for (const record of output) {
      this.writeHeader = false
      this.debug('parsed CSV %j', record)
      let {seq, subject, property, value, who, when} = record

      seq = +seq
      subject = +subject
      value = JSON.parse(value)
      
      let delta = {seq, subject, property, value}

      if (who !== '') delta.who = +who
      if (when !== '') delta.when = new Date(when)

      this.debug(' = delta %o', delta)
      maxS = Math.max(maxS, delta.subject)
      maxD = Math.max(maxD, delta.seq)
      this.deltas.add(delta)
    }
    this.nextSubjectID = maxS + 1
    this.nextDeltaID = maxD + 1
    this.debug('boot complete %d %d', maxS, maxD)
  }

  /*
    Return a new handle for an object; that's all we really have to
    do.  We use numbers.

    To make this synchronous without the slow synchronous boot, we'd
    have to do one of the temp-id tricks I've played with elsewhere,
    like return a placeholder object that can get filled in, or return
    a locally-assigned-id in the negative number space, and maintain a
    mapping between locally-assigned and remotely-assigned (ie on
    disk) numbers.
  */
  create () {
    let id = this.nextSubjectID++
    this.debug('create() returning %d', id)
    return id
  }

  /*
    Read the file, streaming out the deltas

    Used to be async from file, in version linked above...
  */
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

  // which is better? 
  // async applyDelta(delta) {
  //     let {subject, property, value, who, when} = delta

  setProperty (subject, property, value, who, when) {
    const seq = this.nextDeltaID++
    const delta = {seq, subject, property, value, who, when}
    this.applyDelta(delta)
  }

  applyDelta (delta) {
    this.deltas.add(delta)
    this.emit('change', delta.subject, delta)

    let {seq, subject, property, value, who, when} = delta
    value = JSON.stringify(value)
    if (when === null) {
      // 
    } else {
      if (when === undefined) {
        when = new Date()
      }
      if (when.toISOString()) {
        when = when.toISOString()
      }
    } 
    const record = [seq, subject, property, value, who, when]
    let output = d3.csvFormatRows([record])
    this.debug('csv: ', output)
    if (this.fileA === null) {
      this.debug('write after close')
    } else {
      if (this.writeHeader) {
        output = 'seq,subject,property,value,who,when\n' + output
        this.writeHeader = false
      }
      if (delta.seq + 1 !== this.nextDeltaID) throw Error('unexpected async')
      fs.appendFileSync(this.fileA, output + '\n', {encoding: 'utf8'})
      this.emit('save', delta, { filename: this.filename })
      /*
        about once in 100k times, one of these gets delayed and occurs
        in the file slightly out of sequence, so we use Sync instead :-(

      fs.appendFile(this.fileA, output + '\n', {encoding: 'utf8'}, (err) => {
        if (err) throw err
        this.emit('save', delta, { filename: this.filename })
      })
      */
    }
  }
}

module.exports.StoreCSV = StoreCSV
