'use struct'

const debug = require('debug')('datapages_refs')
/*
  Given a structured value (objects, arrays), convert to a from
  versions that have no nested objects, and instead use { ref: ID }
  where there was nesting.   
*/

function refs (create, overlay) {

  const idFor = new Map()   // could be WeakMap, I guess
  const fromID = new Map()
  
  /*
    Given some value, return something we can transmit to indicate
    that value, allowing for object references and loops.

    DOES NOT support circular structures made of ONLY ARRAYS.  That is:
    a = [1,2,a] will cause an infinite loop here.  Don't do that.
  */
  function to (value) {
    debug('toRef(%j)', value)
    if (typeof value !== 'object') return value
    if (value === null) return value

    if (value.toISOString) {
      debug('serializing Date')
      return {iso8601: value.toISOString()}
    }

    if (Array.isArray(value)) {
      const result = value.map(to)
      debug('... = %j (array)', result)
      return result
    }

    // must be normal JS object; replace it with a reference to its id

    let id = idFor.get(value)
    if (id === undefined) {
      id = create()
      idFor.set(value, id)
      fromID.set(id, value)
      
      // Now, this might end up recursing through the graph of connected
      // objects, because overlay() might call us back here, but since
      // we're already in idFor, that won't loop forever.
      overlay(id, value)
    }
    const result = {ref: id}
    debug('... = (%j) (obj)', result)
    return result
  }

  function from (value) {
    if (typeof value !== 'object') return value
    if (value === null) return value

    if (Array.isArray(value)) {
      return value.map(from)
    }
    if (value.iso8601) {
      debug('deserializing date')
      return new Date(value.iso8601) // is there a better iso parser? joda?
    }
    return fromID.get(value.ref)
  }


  return {to, from}
}

module.exports = refs
