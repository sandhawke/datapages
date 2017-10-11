'use strict'

const debugM = require('debug')
const webgram = require('webgram')
const FlatFile = require('./flatfile')
const IDMapper = require('./idmapper')

let instanceCounter = 0

class Server {
  constructor (options = {}) {
    Object.assign(this, options)

    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_server_' + this.debugName)

    if (!this.transport) {
      this.transport = new webgram.Server(options)
    }

    if (!this.dbName) this.dbName = 'server-data'
    if (!this.db) {
      this.db = new FlatFile(options.dbName + '.csv')
    }
    // relies on db already having figure out nextObjectID which
    // would have been nice to be async
    this.idmapper = new IDMapper(this.db.nextObjectID)

    this.transport.on('hello', (conn, a, b, c) => {
      this.debug('HELLO %o %o %o', a, b, c)
    })
    this.transport.on('delta', this.onDelta.bind(this))
    this.transport.on('subscribe', this.onSubscribe.bind(this))
  }

  onDelta (conn, delta) {
    this.debug('heard delta from %o: %o', conn.sessionData._sessionID,
               delta)
    const dd = Object.assign({}, delta)
    dd.who = conn.sessionData._sessionID
    dd.when = new Date()
    dd.seq = undefined

    this.mapInboundDelta(conn, dd) // maybe change these to returning copy?
    this.debug('applying locally as %o', dd)
    this.db.applyDelta(dd)
  }

  mapInboundID (conn, cid) {
    this.debug('inbound cid', cid)
    if (cid > 0) return cid

    if (!conn.cidFor) {
      conn.cidFor = new Map()
      conn.sidFor = new Map()
    }
    let sid = conn.sidFor.get(cid)
    if (sid === undefined) {
      this.debug('no sid for this yet')

      sid = this.db.create()
      conn.sidFor.set(cid, sid)
      conn.cidFor.set(sid, cid)
    }
    this.debug('sid returned as', sid)
    return sid
  }

  mapOutboundID (conn, sid) {
    if (!conn.cidFor) return sid
    let cid = conn.cidFor.get(sid)
    if (cid === undefined) {
      return sid
    }
    return cid
  }

  mapInboundDelta (conn, delta) {
    this.debug('premap: %o', delta)
    delta.subject = this.mapInboundID(conn, delta.subject)
    // map value tree
    this.debug('..post: %o', delta)
  }

  mapOutboundDelta (conn, delta) {
    this.debug('premap: %o', delta)
    delta.subject = this.mapOutboundID(conn, delta.subject)
    // map value tree
    this.debug('..post: %o', delta)
  }

  onSubscribe (conn, view, seq) {
    this.debug('heard subscribe from %o', conn.sessionData._sessionID)
    this.db.listenSince(seq, 'change', (pg, delta) => {
      this.debug('sending delta to %o %o', pg, delta)
      const dd = Object.assign({}, delta)
      this.mapOutboundDelta(conn, dd)
      conn.send('delta', dd)
    })
  }

  /*
    Modify to object references in the delta (the subject, and in the
    value structure) from one id-context into another

  mapDelta (delta, from, to) {
    this.debug('premap subject:', delta.subject)
    delta.subject = (this.idmapper
                     .fromContext(from, delta.subject)
                     .intoContext(to))
    this.debug('........post:', delta.subject)

    this.debug('premap value:', delta.value)
    delta.value = this.idmapper.mapTree(from, to, delta.value)
    this.debug('........post:', delta.value)
  }
  */

  // We used to subclass webgram.Server, but then I wanted to make the
  // transport plugable for easier testing

  /*
  on (...args) {
    return this.transport.on(...args)
  }
  once (...args) {
    return this.transport.once(...args)
  }
  off (...args) {
    return this.transport.off(...args)
  }
  send (...args) {
    return this.transport.send(...args)
  }
  ask (...args) {
    return this.transport.ask(...args)
  }
  */

  close (...args) {
    return this.transport.close(...args)
  }
  // start, stop?
}

module.exports = Server
