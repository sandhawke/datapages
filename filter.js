'use strict'

const debugModule = require('debug')

let seq = 0

class Filter {
  constructor (arg, name) {
    if (!name) name = ++seq
    this.debug = debugModule('datapages_filter_' + name)

    this.clauses = []

    if (typeof arg === 'function') {
      // because I want to be able to send them across the network!
      throw Error('user-defined functions not supported')
    }

    this.clausify(arg)
    // compile?  it'd be pretty easy, but a little harder to debug
  }

  clausify (template) {
    this.debug('clausify %o', template)
    for (let prop of Object.keys(template)) {
      const spec = template[prop]
      this.debug('... prop:', prop, spec)
      if (typeof spec === 'object') {
        for (let op of Object.keys(spec)) {
          const value = spec[op]
          this.clauses.push({prop, op, value})
        }
      } else {
        this.clauses.push({prop, op: '=', value: spec})
      }
    }
    this.debug('clausified to %O', this.clauses)
  }

  passes (page) {
    this.debug('does this filter pass %o?', page)
    for (let clause of this.clauses) {
      if (!this.passesClause(page, clause)) {
        this.debug('... no, failing %o', clause)
        return false
      }
    }
    this.debug('... yes')
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
      case 'required':
        if (value) {
          return left !== undefined && left !== null
        }
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
        this.debug('type of %o is %s', left, type)
        if (type === 'object') {
          if (left instanceof Date) {
            type = 'date'
          } else {
            throw Error('cant check object types yet')
          }
        }
        return left === undefined || type === value
      /*
        if (type === 'object' && Array.isArray(left)) {
        // oh, maybe this will confuse JS people.  hrmmm.
        type = 'array'
        }
      */
    }
    throw Error('unknown comparison operator ' + JSON.stringify(op))
  }
}

module.exports = Filter
