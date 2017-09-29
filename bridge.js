'use strict'

const setdefault = require('setdefault')
const debug = require('debug')('datapages_bridge')

class Bridge {
  constructor (...dbs) {
    this.maps = new Map()  // page-in-db1 => (mapping from dbX => page in dbX)
    this.dbs = dbs
    for (const db of dbs) {

      /*
      // every object each has get added to each other
      db.replayAfter(0, 'appear', pg => {
        // prevent loops; relies on fact that emitted obj is === added obj
        if (this.seen.has(pg)) return
        this.seen.add(pg)
        for (const other of dbs) {
          if (other !== db) {
            other.add(pg)
          }
        }
      })
      */

      db.replayAfter(0, 'change', (pg, delta) => {
        debug('handling change %o\n%O', pg, delta)
        const map = setdefault.lazy(this.maps.get, delta.targetLocalID,
                                    () => {
                                      const m = new Map()
                                      debug('creating new map')
                                      return m
                                    })
        debug('dbs %d, %o', dbs.length, dbs)
        for (const other of dbs) {
          debug('this "other" is %o', other)
          if (other === db) {
            debug('skip propagating to self')
            continue
          }
          debug('time for other...')
          const inOther = setdefault.lazy(
            map,
            other,
            () => {
              const obj = {}
              other.add(obj)
              this.maps.set(obj, map)
              debug('creating new map entry')
              return obj
            })
          debug('  propagating, inOther=%o', inOther)

          // I'm dubious about the refs getting mapped correctly; I think
          // we'd need another mapper for that.
          
          const odelta = {
            targetLocalID: inOther.__localID,
            key: delta.key,
            value: delta.value
          }
          other.applyDeltaLocally(odelta)
        }
        debug('propagation done for this change')
      })
    }
  }
}

module.exports.Bridge = Bridge


// DIFFERENT OBJECT in JS?

// I guess the bridge needs to map NxM
