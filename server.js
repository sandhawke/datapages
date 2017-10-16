'use strict'

const debugM = require('debug')
const webgram = require('webgram')
const FlatFile = require('./flatfile')
// const IDMapper = require('./idmapper')

let instanceCounter = 0

class Server {
  constructor (options = {}) {
    Object.assign(this, options)

    if (!this.debugName) this.debugName = ++instanceCounter
    if (!this.debug) this.debug = debugM('datapages_server_' + this.debugName)

    if (!this.dbName) this.dbName = 'server-data'
    if (!this.db) {
      this.db = new FlatFile(this.dbName + '.csv')
    }
    if (this.doOwners) {
      // probably only works on flatfile and mindb, not inmem, but
      // I think that's true elsewhere in this code already
      if (this.db.nextSubjectID === 1) {
        // can get tricked by manual file
        this.systemID = this.db.create()
      }
    }

    if (!this.transport) {
      if (!options.sessionOptions) options.sessionOptions = {}
      // We have the db dispense our session ids, so that sessions ids
      // ARE database objects.  The page with id sessionID is that
      // session's public "about" page.   TODO only that session write
      // it.
      options.sessionOptions.dispenseSessionID = async () => {
        const id = this.db.create()
        this.debug('dispensing session id', id)
        if (this.doOwners) {
          this.db.setProperty(id, '_owner', id, this.systemID, new Date())
          this.db.setProperty(id, '_isSession', true, this.systemID, new Date())
        }
        return id
      }
      this.transport = new webgram.Server(options)
    }

    this.transport.on('hello', (conn, a, b, c) => {
      this.debug('HELLO %o %o %o', a, b, c)
    })
    this.transport.on('delta', this.onDelta.bind(this))
    this.transport.on('subscribe', this.onSubscribe.bind(this))

    if (this.doOwners) {
      this.transport.on('$session-active', conn => {
        const that = this
        const connObj = this.db.create({isConnection: true,
                                        session: conn.sessionData._sessionID}, this.systemID, new Date())
        const f = function f (deletedConn) {
          if (deletedConn === conn) {
            that.db.delete(connObj)
            that.transport.off('$closed', f)
          }
        }
        this.transport.on('$closed', f)
      })
    }
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

    // TODO: check that _sessionID === _owner, but right now we don't
    // have an inmemory version of the _owner of every id.  We'd have
    // to load that now, OR write it now knowing it might be something
    // we'll ignore later on read-through.  IE it's a suggestion.
    // HRM.
    
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
      this.debug('dispensing OBJECT id', sid)
      if (this.doOwners) {
        this.db.setProperty(sid, '_owner', conn.sessionData._sessionID,
                            this.systemID, new Date())
      }
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

  async close (...args) {
    await Promise.all([
      this.db.close(),
      this.transport.close(...args)
    ])
  }
  // start, stop?
}

module.exports = Server
