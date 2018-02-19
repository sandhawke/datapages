'use strict'

const debug = require('debug')('datapages_view')
// const EventEmitter = require('eventemitter3')
const Filter = require('./filter').Filter
const BaseDB = require('./basedb')

// base might be a DB() or another "upstream" View.  We're always more
// restrictive than the base, narrowing which pages appear.
//
// base must make available the current state of its members, it can't just
// passthrough deltas.    but they don't need to be enumerable...

function scalar (val) {
  const t = typeof val
  if (t === 'string' || t === 'number' || t === 'boolean' ||
      val === null || val === undefined) {
    return true
  }
  return false
}

class View extends BaseDB {
  constructor (options = {}, base) {
    super()
    Object.assign(this, options)
    if (!options.base) this.base = base

    if (!this.filterObject) {
      this.filterObject = new Filter(this.filter, this.name)
    }

    this.members = new Set()
    if (this.groupBy) this.groups = new Map()

    // NO, determine this for ourselves
    // this.base.on('stable', () => { this.emit('stable') })

    this.base.on('disappear', (page, delta) => { this._delete(page, delta) })

    this.changeHandler = (page, delta) => {
      this.debug('handling change from base %o', delta)
      const [was, is] = this.consider(page, delta)
      if (is) {
        debug('view emiting "delta"', was, is)
        // maybe:  delta.target = page ?
        this.emit('delta', delta)
      }
    }

    // this is kinda horrible.  We can't replay yet, because no one
    // has had a chance to attach listeners.  Oh maybe that's okay,
    // when they do we'll just run through again, as we do.

    // this.base.on('change', this.changeHandler)
    this.base.listenSince(0, 'change', this.changeHandler)
  }

  createBlank () {
    return this.base.create()
  }

  create (...args) {
    const page = super.create(...args)
    debug('page created: %O', page)
    if (this.passes(page)) {
      return page
    }
    // This would be nice, in terms of catching errors, but it
    // doesn't work, because if the view is on a Remote db, the
    // changes don't happen synchronously

    // throw Error('page created in view does not pass view filter')
    return null
  }

  _add (page, delta, emit) {
    this.members.add(page, delta)
    if (this.groupBy) {
      const group = this.groupFor(page)
      let gMembers = this.groups.get(group)
      if (!gMembers) {
        gMembers = new Set()
        this.groups.set(group, gMembers)
      }
      gMembers.add(page)
    }
    if (emit) this.emit('appear', page, delta)
  }

  _delete (page, delta) {
    this.members.delete(page)
    if (this.groupBy) {
      const group = this.groupFor(page)
      const gMembers = this.groups.get(group)
      gMembers.delete(page)
    }
    this.emit('disappear', page, delta)
  }

  // what is the index value for this page, according to groupBy
  //
  groupFor (page) {
    const by = this.groupBy
    if (typeof by === 'string') {
      const result = page[by]
      if (scalar(result)) return result
      throw Error('groupBy only implemented for scalar values')
    }
    if (Array.isArray(by)) {
      const result = []
      for (const prop of by) {
        const val = page[prop]
        if (scalar(val)) {
          result.push(val)
        } else {
          throw Error('groupBy only implemented for scalar values')
        }
      }
      // hm, we can't just return the array, because Map will map
      // ['x'] and ['x'] to two different places. So we can jsonify it
      // into a string. Downside is when someone is traversing
      // view.groups, the keys are in json form.  Alternatively, we
      // could keep a map from array values to the original instance
      // of that array, but that seems like a silly amount of extra
      // work.  JSON it is.
      return JSON.stringify(result)
    }
    throw Error('if defined, groupBy must be string or array of strings')
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
        this._delete(page, delta)
      }
    } else {
      if (passes) {
        debug('... it now belongs, appear')
        this._add(page, delta, true)
      } else {
        debug('... it still does not belong')
      }
    }
    return [wasIn, passes]
  }

  eventreconsider (page) {
    debug('reconsidering %o', page)
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
        this._add(page, null, false)
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
    let result = this.members.values()

    // TEMPORARY HACK: this should be done differently, so that
    // appear/disappear are emitted for things going out of the limit,
    // and of course this isn't a very efficient approach.
    if (this.sortBy) {
      if (typeof this.sortBy !== 'string') {
        // not a function, people, not a function
        throw Error('sortBy should be a string which names a property')
      }
      result = Array.from(result)
      const f = (a, b) => {
        const va = a[this.sortBy]
        const vb = b[this.sortBy]
        if (va < vb) return -1
        if (va > vb) return 1
        return 0
      }
      result.sort(f)
      if (this.limit !== undefined) {
        result.splice(this.limit)
      }
      // console.log('sorted', result.map(x => x.name))

      result = result[Symbol.iterator](result)
    }

    return result
  }

  get size () {
    return this.members.size
  }

  get length () {
    return this.members.size
  }

  only (onZero, onMany) {
    const results = Array.from(this)
    this.debug('only() found items', results)
    if (results.length === 0) {
      if (onZero === undefined) throw Error('constraint violation with "only"')
      return onZero
    }
    if (results.length > 1) {
      if (onMany === undefined) throw Error('constraint violation with "only"')
      return onMany
    }
    return results[0]
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

  // return a JSON-able version of groups, no Set or Map
  get groupsObject () {
    const result = {}
    for (const [key, val] of this.groups) {
      result[key] = Array.from(val)
    }
    return result
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
