'use strict'

const debug = require('debug')('datapages_view')
const EventEmitter = require('eventemitter3')
const Filter = require('./filter').Filter
const BaseDB = require('./basedb')

// base might be a DB() or another "upstream" View.  We're always more
// restrictive than the base, narrowing which pages appear.
//
// base must make available the current state of its members, it can't just
// passthrough deltas.    but they don't need to be enumerable...

class View extends BaseDB {
  constructor (options = {}, base) {
    super()
    Object.assign(this, options)
    if (!options.base) this.base = base

    if (!this.filterObject) {
      this.filterObject = new Filter(this.filter, this.name)
    }

    this.members = new Set()

    // NO, determine this for ourselves
    // this.base.on('stable', () => { this.emit('stable') })

    this.base.on('disappear', page => {
      this.members.delete(page)
      this.emit('disappear', page)
    })

    this.base.on('change', (page, delta) => {
      const [was, is] = this.consider(page, delta)
      if (is) {
        debug('view emiting "delta"', was, is)
        // maybe:  delta.target = page ?
        this.emit('delta', delta)
      }
    })

    // let this wait, so folks have time to add on-appear handler
    //
    // maybe some race conditions here.   :-(
    //
    /*
    process.nextTick(async () => {
      const endSeq = await this.base.maxSeq()
      this.base.replaySince(0, 'change', (pg, delta) => {
        this.consider(pg)
        if (delta.seq >= endSeq) this.emit('stable')
      })
    })
    */
  }

  async maxSeq () {
    return this.base.maxSeqUsed
  }

  consider (page, delta) {
    debug('considering %o', page)
    const passes = this.passes(page)
    let wasIn = false
    if (this.members.has(page)) {
      wasIn = true
      if (passes) {
        debug('... it still belongs')
      } else {
        debug('... it no longer belongs, disappear')
        this.members.delete(page)
        this.emit('disappear', page, delta)
      }
    } else {
      if (passes) {
        debug('... it now belongs, appear')
        this.members.add(page)
        this.emit('appear', page, delta)
      } else {
        debug('... it still does not belong')
      }
    }
    return [wasIn, passes]
  }

  eventreconsider (page) {
    debug('considering %o', page)
    const passes = this.passes(page)
    let wasIn = false
    if (this.members.has(page)) {
      wasIn = true
      if (passes) {
        debug('... it still belongs')
      } else {
        debug('... it no longer belongs, disappear')
        this.members.delete(page)
        return 'disappear'
      }
    } else {
      if (passes) {
        debug('... it now belongs, appear')
        this.members.add(page)
        return 'appear'
      } else {
        debug('... it still does not belong')
      }
    }
    return [wasIn, passes]
  }

  
  passes (page) {
    if (page._deleted) return false
    return this.filterObject.passes(page)
  }

  check (page) {
    if (!this.passes(page)) throw Error('page constraint violation')
  }

  // Adapters for the DB methods

  get (...args) {
    const page = this.base.get(...args)
    if (page) {
      // if you do the GET on the view, and it doesn't qualify for the
      // view, then ... throw error?!
      this.check(page)
    }
    return page
  }

  items () {
    debug('items() called')
    return this.members.values()
  }

  async add (page) {
    this.check(page)
    await this.base.add(page)
  }

  async overlay (page, overlay) {
    // NOT CHECKING, because we don't do the local modify right now
    this.base.overlay(page, overlay)
  }

  view (arg) {
    console.warn('subviews do not currently participate in the schema')
    // name them like 'root.sub.subsub' ?
    return new View(arg, this)
  }

  listenSince (seq, ev, fn) {
    switch (ev) {
    case 'change':
      return this.base.listenSince(seq, ev, (pg, delta) => {
        if (this.passes(pg)) fn(pg, delta)
      })
    case 'appear':  // not sure this is right....
      // do this first so we don't miss any?   and we don't care about order?
      this.on('appear', fn)
      for (const page of this.items()) {
        fn(page)
      }
      return Promise.resolve()
    case 'disappear':  // or this...
      this.on('disappear', fn)
      return Promise.resolve()
    default:
        throw Error(`unknown listenSince event "${ev}"`)
    }
  }
}

View.prototype[Symbol.iterator] = function () {
  return this.items()
}

// can't put this in basedb.js because it would be a circular class
// definition
BaseDB.prototype.view = function (options) {
  return new View(options, this)
}

module.exports = View
