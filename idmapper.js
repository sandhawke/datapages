'use strict'

/*
  factor out into separate package?

  Maintain a bunch of mappings, so that we can talk to lots of
  different clients about objects using object numbers, and either
  side can assign the numbers, and they'll never collide.

  The trick is that when WE assign an object number, it's 1, 2, 3,
  ... but when any client does it, they need to use something else, eg
  negative numbers.  Since all communication is really pairwise, this
  is good enough for very cheaply getting global object identifiers.

  As soon as it's not a start topology, we would need something else,
  like uuids or urls.

*/

class IDMapper {
  constructor (counter = 0) {
    this.idCounter = counter
    this.contextSpecials = new WeakMap()
    this.idmaps = new Map()
  }

  // return the idmap that goes with this (context, id)
  fromContext (context, id) {
    if (typeof id === 'number' && id > 0) {
      // this is a shared id, not a local id, so it's easy
      const result = this.idmaps.get(id)
      if (result === undefined) {
        throw Error('positive integer id, but we never gave it out')
      }
      return result
    }

    // find the mapping of exceptions, for this context
    let csp = this.contextSpecials.get(context)
    if (csp === undefined) {
      csp = new Map()
      this.contextSpecials.set(context, csp)
    }

    // within that mapping, is this id an exception?
    let idmap = csp.get(id)
    if (idmap === undefined) {
      // okay, this must be new...
      const newId = ++this.idCounter
      idmap = new IDMap(this, newId)
      idmap._set(context, id)
      this.idmaps.set(newId, idmap)
      csp.set(id, idmap)
    }
    return idmap
  }
}

class IDMap {
  constructor (mapper, defaultID) {
    this.mapper = mapper
    this.defaultID = defaultID
    this.special = new Map()
  }

  // return the id for use in this context
  intoContext (context) {
    let val = this.special.get(context)
    if (val === undefined) {
      return this.defaultID
    }
    return val
  }

  _set (context, id) {
    this.special.set(context, id)
  }
}

module.exports = IDMapper
