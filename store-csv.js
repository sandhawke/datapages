'use strict'

const EventEmitter = require('eventemitter3')
const debugM = require('debug')
var fs = require('fs');
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
  }

  create () {
    return { __placeholder: true }
  }

  listenSince (seq, name, cb) {
    // open file and read it, subject = line-number

    var parser = parse({delimiter: ':'})
    var input = fs.createReadStream(this.filename);
    const sink = new EventEmitter()
    sink.write = (obj) => {
      cb(obj.subject, obj)
    }
    sink.end = () => {
      this.emit('stable')  // replay-done?
      this.debug('done')
    }

    input.pipe(parser).pipe(sink)
  }

  setProperty (subject, property, value, who, when) {
    if (typeof subject === 'object') {
      if (subject.__assignedID) {
        subject = subject.__assignedID
      } else if (subject.__placeholder) {
        await idDispender, set subject.id
      } else {
        throw Error('bad first argument to setProperty')
      }
    }
    // if simple number, then fine, append this delta
    const record = [subject, property, value, who, when]
    stringify([record], (err, output) => {
      this.debug('csv: ', output)

      // when it's written, emit  subject save    details about file
    })
  }
}

module.exports.StoreCSV = StoreCSV
