'use strict'

const debug = require('debug')('datapages_view')
const EventEmitter = require('eventemitter3')
const Filter = require('./filter')

// base might be a DB() or another "upstream" View.  We're always more
// restrictive than the base, narrowing which pages appear.

class View extends EventEmitter {
  constructor (options = {}, base) {
    super()
    Object.assign(this, options)
    if (!options.base) this.base = base

    if (!(this.filter.passes)) {
      this.filter = new Filter(this.filter)
    }

    this.members = new Set()

    this.base.on('stable', () => { this.emit('stable') })

    this.base.on('appear', page => {
      this.consider(page)
    })

    this.base.on('disappear', page => {
      this.members.delete(page)
      this.emit('disappear', page)
    })

    this.base.on('changed', (page, delta) => {
      this.consider(page)
    })
  }

  consider (page) {
    debug('considering %o', page)
    const passes = this.passes(page)
    if (this.members.has(page)) {
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
  }

  passes (page) {
    if (this.filter) {
      return this.filter.passes(page)
    }
    return true
  }

  check (page) {
    if (!this.passes(page)) throw Error('page constraint violation')
  }

  // Adapters for the DB methods

  get (...args) {
    const page = this.base.get(...args)
    // if you do the GET on the view, and it doesn't qualify for the
    // view, then ... throw error?!
    this.check(page)
    return page
  }

  items () {
    return this.members.values()
  }

  add (page) {
    this.check(page)
    this.base.add(page)
  }

  overlay (page, overlay) {
    // NOT CHECKING, because we don't do the local modify right now
    this.base.overlay(page, overlay)
  }

  filter (f) {
    return new View({filter: f}, this)
  }

  view (arg) {
    return new View(arg, this)
  }
}

module.exports = View