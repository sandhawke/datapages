'use strict'
/*

  Store deltas in a flat file, eg a CSV file

  TODO: make a version with no this.deltas, that just streams the file
  out; could run on lower memory systems as deltas gets big.

  TODO: make _loadState fast, even with huge file, by recording in a
  status.json file an offset into the main file where the max targetID
  was written, which ought to be very near the end.  I think that
  avoids any races.  **OR** switch to one of the versions of create
  where we don't need to know the object number, maybe

  TODO: add other forms : .jsonl .cbor .nquads

  TODO: tools for saving space by forgetting short-lived values

*/

const fs = require('fs')
const dsv = require('d3-dsv')
const BaseDB = require('./basedb')

class FlatFile extends BaseDB {
  constructor (filename = 'deltas.csv', options = {}) {
    super()
    Object.assign(this, options)

    this.filename = filename

    this.deltas = new Set()
    this.buffer = []

    this.writeHeader = true
    this._loadState()
    this._startWriter()
  }

  close () {
    return new Promise(resolve => {
      this.debug('\n\n\n\n\n****************************   closing file %s', this.filename)
      this.pleaseClose = () => {
        // this will run when the output buffer has been written
        fs.close(this.fileA, resolve)
        this.fileA = null
      }
    })
  }

  _startWriter () {
    fs.open(this.filename, 'a', 0o600, (err, fd) => {
      if (err) throw err
      this.fileA = fd
      this.debug('file %s open for append, fd %o', this.filename, fd)

      if (this.writeHeader) {
        this.writeHeader = false
        const header = 'seq,subject,property,value,who,when\n'
        fs.appendFile(this.fileA, header, {encoding: 'utf8'}, (err) => {
          if (err) throw err
          this._writeLoop()
        })
      } else {
        this._writeLoop()
      }
    })
  }

  _writeLoop () {
    // sometimes this is useful to remind us this is keeping us alive,
    // but it's too noisy.
    // this.debug('writeLoop running')
    
    // we could do a join('') before calling appendFile, but some
    // measurements suggest appendFile's buffering is at least as
    // good
    const entry = this.buffer.shift()
    if (!entry) {
      if (this.pleaseClose) {
        this.pleaseClose()
      } else {
        setTimeout(() => { this._writeLoop() }, 10)
      }
      return
    }
    fs.appendFile(this.fileA, entry.text, {encoding: 'utf8'}, (err) => {
      if (err) throw err
      this.emit('save', entry.delta)
      this._writeLoop()
    })
  }

  async replaySince (seq, name, cb) {
    for (const delta of this.deltas) {
      cb(delta.subject, delta)
    }
  }

  _loadState () {
    this.debug('_loadState running')
    let input = ''
    try {
      input = fs.readFileSync(this.filename, 'utf8')
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    this.debug('input as %d chars', input.length)
    let maxS = 0
    let maxD = 0
    const output = dsv.csvParse(input)
    this.debug('parsed whole as %O', output)
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
  createBlank () {
    let id = this.nextSubjectID++
    this.debug('create() returning %d', id)
    return id
  }

  applyDelta (delta) {
    this.debug('applyDelta() %o', delta)
    if (delta.seq === undefined) delta.seq = this.nextDeltaID++
    this.deltas.add(delta)
    this.emit('delta', delta)
    this.debug(' after emit() %o', delta)

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
    this.debug('record: %o', record)
    let text = dsv.csvFormatRows([record]) + '\n'
    this.debug('as cvs: %o', text)
    this.buffer.push({delta, text})
  }
}

module.exports = FlatFile
