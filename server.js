'use strict'

// should we use new id numbers for each connection?  that'll keep
// things looking simpler for the client, but at the cost of extra
// mapping in the server...

const level = require('level')
const bytewise = require('bytewise')
const cbor = require('borc-refs')
const webgram = require('webgram')
const webgramSessions = require('webgram-sessions')
const IDMapper = require('./idmapper')
const debug = require('debug')('datapages:server')

// inherit vs attach...?  Hrmmmm.
//
// we need to do our start/load thing first...
//    server = datapages.wrap(server) ?

class Server extends webgram.Server {
  constructor (config) {
    super(config)   // it copies all config to this.*
    if (!this.deltaDB) this.openDB()
    this.maxSeq = 0
    this.idmapper = new IDMapper()

    webgramSessions.attach(this)

    this.subscribers = new Set()

    this.on('$close', (conn) => {
      debug('closing connection, removing watcher')
      this.subscribers.delete(conn)
    })

    this.on('subscribe', async (conn, options) => {
      debug('handling subscribe', options)
      debug('before: size=', this.subscribers.size,
            'this is session', conn.sessionData._sessionID)
      if (options.since !== undefined) {
        await this.runReplay(conn)
        // is it possible to drop events between this disk-traversal
        // and getting added to subscribers?   Maybe we should be buffering
        // up the events being dispatched, and if the disk-read ever hits
        // the first one buffered, we stop the disk read and switch to
        // memory?
      }
      debug('replay done, actually adding to subscribers now')
      this.subscribers.add(conn)
      debug('after: size=', this.subscribers.size)
    })

    this.on('delta', async (conn, delta) => {
      debug('handling delta', delta)
      console.log('got delta', delta)
      delta.who = conn.sessionData._sessionID
      delta.when = new Date()
      delta.seq = ++this.maxSeq
      const idmap = this.idmapper.fromContext(conn, delta.targetLocalID)

      delta.targetLocalID = idmap.intoContext(this.deltaDB)
      this.deltaDB.put(delta.seq, delta)
      debug('saved delta %o', delta)

      debug('distributing delta to subscribers, %o', this.subscribers)
      for (let w of this.subscribers) {
        debug('subscriber: %o', w)
        // send it back to sender...?  hrmmm.  confirms we got it, and
        // lets them know if we assign a global ID or something... I guess.
        delta.targetLocalID = idmap.intoContext(w)
        try {
          w.send('delta', delta)
        } catch (e) {
          console.error('subscriber error', e)
        }
      }
    })
  }

  async start () {
    this.maxSeq = await this.bootReplay()
    await super.start()
    console.log('ws at', this.address)
  }

  openDB () {
    this.deltaDB = level('data.deltas', {
      keyEncoding: bytewise,
      valueEncoding: cbor
    })
    // similar to JSON, but handles binary values nicely, and
    // even cyclical and lattice structures
    this.deltaDB._codec.encodings.cbor = {
      encode: cbor.encode,
      decode: cbor.decode,
      buffer: true,
      type: 'cbor'
    }
    // sorts numbers in order, which is important for deltas
    this.deltaDB._codec.encodings.bytewise = {
      encode: bytewise.encode,
      decode: bytewise.decode,
      buffer: true,
      type: 'bytewise'
    }
  }

  bootReplay () {
    return new Promise((resolve, reject) => {
      let count = 0
      let maxSeq = 0
      this.deltaDB.createReadStream()
        .on('data', function (data) {
          count++
          debug('    %n => %o', data.key, data.value)
          if (data.key > maxSeq) maxSeq = data.key
        })
        .on('error', function (err) {
          console.log('Error', err)
          reject(err)
        })
        .on('end', function () {
          console.log('Database has', count, 'deltas, maxSeq=', maxSeq)
          resolve(maxSeq)
        })
    })
  }

  // stream all the deltas to conn
  //
  // in the future allow args to limit how far back we go, and maybe
  // to ignore certain kinds of deltas
  //
  runReplay (conn) {
    return new Promise((resolve, reject) => {
      debug('replaying database for subscriber')
      let count = 0
      this.deltaDB.createReadStream()
        .on('data', function (data) {
          count++
          // debug('    ', data.key, ' => ', data.value)
          const delta = data.value

          // we DO NOT do id-mapping here, because we assume/know that
          // (1) it was always sharedIds (pos ints) written to the log
          // (since we never do a fromContext from the log)
          // and (2) the client never asks for a replay when it's created
          // objects...     Maybe we could check that?
          // idmapper.empty(conn) ?

          conn.send('delta', delta)
        })
        .on('error', function (err) {
          console.log('Error', err)
          reject(err)
        })
        .on('end', function () {
          conn.send('replay-complete')
          debug(count, 'deltas sent in replay')
          resolve()
        })
    })
  }
}

module.exports.Server = Server
