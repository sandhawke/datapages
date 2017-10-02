'use strict'
/*

  Implements the L1 (primitive) interface

  There was kinda-working version with no storage and all-async, at
  https://github.com/sandhawke/datapages/blob/64432ceb79d46ecae85acd4ba709028f973766d8/store-csv.js
  before I deciding simplicity was much more important than
  performance for now

  TODO maybe add other forms : .jsonl .cbor .nquads

*/

const debugM = require('debug')
const fs = require('fs')
const mutexify = require('mutexify')
const dsv = require('d3-dsv')
const BaseDB = require('./basedb')

let instanceCounter = 0

class FlatFile extends BaseDB {
  constructor (filename, options = {}) {
    super()
    Object.assign(this, options)

    this.filename = filename
    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_store_csv_' + this.debugName)

    this.lockA = mutexify()
    this.outbuf = []
    this.outbufcb = []
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
    const input = fs.readFileSync(this.filename, 'utf8')
    this.debug('input as %d chars', input.length)
    let maxS = 0
    let maxD = 0
    const output = dsv.csvParse(input)
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

  applyDelta (delta) {
    if (delta.seq === undefined) delta.seq = this.nextDeltaID++
    this.deltas.add(delta)
    this.emit('delta', delta)

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

    if (this.writeHeader) {
      this.outbuf.push('seq,subject,property,value,who,when\n')
      this.writeHeader = false
    }

    const record = [seq, subject, property, value, who, when]
    this.debug('record: %o', record)
    let output = dsv.csvFormatRows([record])
    this.debug('as cvs: %o', output)
    this.outbuf.push(output + '\n')
    this.outbufcb.push(() => {
      this.emit('save', delta, { filename: this.filename })
    })

    // mutex so that we only have one outstanding fs.appendFile at
    // once because sometimes (like 1 in 100k calls) they end up being
    // written out-of-order.  This also makes it easy to buffer up the
    // writes, which maybe speeds this up a little.
    this.lockA(release => {
      this.debug('writing %d lines', this.outbuf.length)
      if (this.outbuf.length) {
        if (this.fileA === null) {
          this.debug('write after close')
        } else {
          // atomically make our copies of outbuf and outbufcb
          const outtext = this.outbuf.join('')
          const outcbs = this.outbufcb
          this.outbuf = []
          this.outbufcb = []
          // now we can go off while doing the appendFile, and others
          // can be adding to the new outbuf + outbufcb
          fs.appendFile(this.fileA, outtext, {encoding: 'utf8'}, (err) => {
            if (err) throw err
            release()
            for (const cb of outcbs) {
              cb()
            }
          })
          this.outbuf = []
          this.outbufcb = []
        }
      }
    })
  }

    /*

      }

      if (delta.seq + 1 !== this.nextDeltaID) throw Error('unexpected async')

      fs.appendFileSync(this.fileA, output + '\n', {encoding: 'utf8'})
      this.emit('save', delta, { filename: this.filename })

      /*
        about once in 100k times, one of these gets delayed and occurs
        in the file slightly out of sequence, so we use Sync instead :-(

        trying with mutexify, also no working, for other reasons TBD.

        Probably best would be to buffer up all the writes during one write,
        then proceed with them.  Mutexify should do that nicely.

      this.lockA(release => {
        this.debug('got lock for %o', output)
        fs.appendFile(this.fileA, output + '\n', {encoding: 'utf8'}, (err) => {
          if (err) throw err
          release()
          this.emit('save', delta, { filename: this.filename })

        })
      })
      */
}

module.exports = FlatFile
