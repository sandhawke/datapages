'use strict'

const debugModule = require('debug')

let seq = 0

const canon = {
  '=': 'eq',
  '!=': 'ne',
  '<': 'lt',
  '<=': 'le',
  '>': 'gt',
  '>=': 'ge'
}

class Filter {
  constructor (arg, name) {
    if (!name) name = ++seq
    this.debug = debugModule('datapages_filter_' + name)

    this.clauses = []

    if (typeof arg === 'function') {
      this.debug('arg was function? %o', arg)
      // because I want to be able to send them across the network!
      throw Error('user-defined functions not supported')
    }

    this.clausify(arg || {})
    // compile?  it'd be pretty easy, but a little harder to debug
  }

  clausify (template) {
    this.debug('clausify %o', template)
    this.debug('this === template?', this === template)
    this.debug('CLAUSIFY?! %j', template)
    this.debug('CLAUSIFY... .clauses:', template.clauses)
    if (template.debug || template.clauses || template instanceof Filter) throw Error('WTF trap')

    for (let prop of Object.keys(template)) {
      const spec = template[prop]
      this.debug('... prop:', prop, spec)
      if (typeof spec === 'object') {
        for (let op of Object.keys(spec)) {
          const value = spec[op]
          const canonicalOp = canon[op]
          if (canonicalOp) op = canonicalOp
          this.clauses.push({prop, op, value})
        }
      } else {
        this.clauses.push({prop, op: 'eq', value: spec})
      }
    }
    this.debug('clausified to %O', this.clauses)
  }

  // for each eq function, SET that value on page
  setFixed (page) {
    if (!page) return
    for (let clause of this.clauses) {
      if (clause.op === 'eq') {
        page[clause.prop] = clause.value
      }
    }
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
      case 'eq':
        return left === value
      case 'ne':
        return left !== value
      case 'lt':
        return left < value
      case 'le':
        return left <= value
      case 'gr':
        return left > value
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
        if (value instanceof Set) {
          return value.has(left)
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

// for people who don't want to use view.passes(page) probably because
// they're not really using real views, just filters...
function filterForView (view) {
  if (!view.filterObject) {
    view.filterObject = new Filter(view.filter, view.name)
  }
  return view.filterObject
}

module.exports.Filter = Filter
module.exports.filterForView = filterForView
