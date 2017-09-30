'use strict'

// should we use new id numbers for each connection?  that'll keep
// things looking simpler for the client, but at the cost of extra
// mapping in the server...

const level = require('level')
const bytewise = require('bytewise')
const cbor = require('borc-refs')
const webgram = require('webgram')
const IDMapper = require('./idmapper')
const debug = require('debug')('datapages-server')

// inherit vs attach...?  Hrmmmm.
//
// we need to do our start/load thing first...
//    server = datapages.wrap(server) ?

class Server extends webgram.Server {
  constructor (config) {
    super(config)   // it copies all config to this.*
    if (!this.deltaDB) this.openDB()
    this.maxSeq = undefined // set by start()
    this.idmapper = undefined // set by start()

    this.on('$close', (conn) => {
      debug('closing connection, remove watcher')
      this.off('$delta-saved', conn.deltaSavedHandler)
    })

    this.on('subscribe', async (conn, options) => {
      debug('handling subscribe', options)
      // We need to buffer all the notifications that occur between
      // now and the time the from-disk reply is done.  LevelDB will
      // only replay up to the delta where the replay started, even if
      // more are added during the replay.
      let buffer = []
      const send = pair => {
        const [idmap, delta] = pair
        delta.targetLocalID = idmap.intoContext(conn)
        conn.send('delta', delta)
      }
      conn.deltaSavedHandler = (...pair) => {
        if (buffer) {
          buffer.push(pair)
        } else {
          send(pair)
        }
      }
      this.on('$delta-saved', conn.deltaSavedHandler)

      if (options.since !== undefined) {
        await this.runReplay(conn)
        debug('from-disk replay done')
      }
      debug('starting from-memory replay')
      for (let pair of buffer) send(pair)
      buffer = false
      debug('from-memory replay done; now we are live')
    })

    this.answer.delta = async (conn, delta) => {
      debug('handling delta', delta)
      delta.who = conn.sessionData._sessionID
      delta.when = new Date()
      delta.seq = ++this.maxSeq

      const idmap = this.idmapper.fromContext(conn, delta.targetLocalID)
      delta.targetLocalID = idmap.intoContext(this.deltaDB)

      debug('premap value:', delta.value)
      delta.value = this.idmapper.mapTree(conn, this.deltaDB, delta.value)
      debug('........post:', delta.value)
      /*
      if (delta.type === 'ref') {
        const idmap = this.idmapper.fromContext(conn, delta.value)
        delta.value = idmap.intoContext(this.deltaDB)
      }
      */

      this.deltaDB.put(delta.seq, delta)
      debug('saved delta %o', delta)

      this.emit('$delta-saved', idmap, delta)
      /*
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
      */
      return true // confirming that we got it, just in case you're
                  // not subscribed or don't want to track it that
                  // way.    We COULD make the return trip optional.
    }
  }

  async innerStart () {
    debug('start() called')
    const replay = await this.bootReplay()
    debug('replay stats: %o', replay)
    this.maxSeq = replay.maxSeq
    this.idmapper = new IDMapper(replay.id)
    debug('calling super.start()')
    await super.innerStart()
    debug('super.start() returned')
    console.log('ws at', this.address)
  }

  openDB () {
    debug('openDB')
    this.deltaDB = level(this.deltasDBName || 'data.deltas', {
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
    this.closeDB = true
  }

  async close () {
    if (this.closeDB) {
      debug('closing DB')
      await this.deltaDB.close()
    }
    await super.close()
  }

  bootReplay () {
    return new Promise((resolve, reject) => {
      let count = 0
      let maxSeq = 0
      let id = 0
      debug('running bootReplay')
      this.deltaDB.createReadStream()
        .on('data', function (data) {
          count++
          debug('    %i => %j', data.key, data.value)
          if (data.key > maxSeq) maxSeq = data.key
          const thisID = data.value.targetLocalID
          if (thisID > id) id = thisID
        })
        .on('error', function (err) {
          console.log('Error', err)
          reject(err)
        })
        .on('end', function () {
          console.log('Database has', count, 'deltas, maxSeq=',
                      maxSeq, 'maxTarget', id)
          resolve({maxSeq, id})
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
