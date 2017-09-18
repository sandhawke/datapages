'use strict'

const debug = require('debug')('datapages_filter')

class Filter {
  constructor (arg) {
    this.clauses = []

    if (typeof arg === 'function') {
      // because I want to be able to send them across the network!
      throw Error('user-defined functions not supported')
    }

    this.clausify(arg)
    // compile?  it'd be pretty easy, but a little harder to debug
  }

  clausify (template) {
    debug('clausify %o', template)
    for (let prop of Object.keys(template)) {
      const spec = template[prop]
      debug('... prop:', prop, spec)
      if (typeof spec === 'object') {
        for (let op of Object.keys(spec)) {
          const value = spec[op]
          this.clauses.push({prop, op, value})
        }
      } else {
        this.clauses.push({prop, op: '=', value: spec})
      }
    }
    debug('clausified to %O', this.clauses)
  }

  passes (page) {
    debug('does this filter pass %o?', page)
    for (let clause of this.clauses) {
      if (!this.passesClause(page, clause)) {
        debug('... no, failing %o', clause)
        return false
      }
    }
    debug('... yes')
    return true
  }

  passesClause (page, {prop, op, value}) {
    const left = page[prop]
    switch (op) {
      case '=':
      case 'eq':
        return left === value
      case '!=':
      case 'ne':
        return left !== value
      case '<':
      case 'lt':
        return left < value
      case '<=':
      case 'le':
        return left <= value
      case '>':
      case 'gr':
        return left > value
      case '>=':
      case 'ge':
        return left >= value
      case 'exists':
        const exists = left !== undefined && left !== null
        return exists === value
      case 'wanted':
      // this signals the value should be included, if exists
      // (but right now we included everything anyway)
        return true
      case 'in':
        if (Array.isArray(value)) {
          return value.includes(left)
        }
        throw Error('"in" needs the comparison value to be an array')
      case 'includes':
        if (Array.isArray(left)) {
          return left.includes(value)
        }
        return false
      case 'type':
        let type = typeof left
      /*
      if (type === 'object' && Array.isArray(left)) {
        // oh, maybe this will confuse JS people.  hrmmm.
        type = 'array'
      }
      */
        return type === value
    }
    throw Error('unknown comparison operator ' + JSON.stringify(op))
  }
}

module.exports = Filter
