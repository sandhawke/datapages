'use strict'

const debug = require('debug')('datapages_view')
const EventEmitter = require('eventemitter3')
const Filter = require('./filter').Filter

// base might be a DB() or another "upstream" View.  We're always more
// restrictive than the base, narrowing which pages appear.
//
// base must make available the current state of its members, it can't just
// passthrough deltas.    but they don't need to be enumerable...

class View extends EventEmitter {
  constructor (options = {}, base) {
    super()
    Object.assign(this, options)
    if (!options.base) this.base = base

    if (!this.filterObject) {
      this.filterObject = new Filter(this.filter, this.name)
    }

    this.members = new Set()

    this.base.on('stable', () => { this.emit('stable') })

    this.base.on('disappear', page => {
      this.members.delete(page)
      this.emit('disappear', page)
    })

    this.base.on('change', (page, delta) => {
      const [was, is] = this.consider(page)
      if (is) {
        debug('view emiting "change"', was, is)
        // maybe:  delta.target = page ?
        this.emit('change', page, delta)
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

  consider (page) {
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
        this.emit('disappear', page)
      }
    } else {
      if (passes) {
        debug('... it now belongs, appear')
        this.members.add(page)
        this.emit('appear', page)
      } else {
        debug('... it still does not belong')
      }
    }
    return [wasIn, passes]
  }

  passes (page) {
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
      case 'appear':
      case 'disappear':
      default:
        throw Error(`unknown listenSince event "${ev}"`)
    }
  }
}

module.exports = View
