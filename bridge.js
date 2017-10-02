'use strict'

// use symbols we add to the proxies/handles but that means they can't
// be integer ids.   Poop.   weakmap wouldn't work either.

const setdefault = require('setdefault')
const debug = require('debug')('datapages_bridge')

class Bridge {
  constructor (...dbs) {
    // silly, but after I wrote this, I realized this algorithm is all
    // wrong for > 2 dbs, because this makes cycles, and you need a
    // tree to do it this way.
    if (dbs.length !== 2) throw Error('needs exactly two arguments')
    this.dbs = dbs
    this.listens = []
    const map = new Map()
    // map.get(src).get(sink).get(srcObj) == sinkObj
    // map.get(sink).get(src).get(sinkObj) = srcObj

    const newMap = () => new Map()
    for (const src of dbs) {
      for (const sink of dbs) {
        if (src === sink) continue
        const forward1 = setdefault.lazy(map, src, newMap)
        const forward = setdefault.lazy(forward1, sink, newMap)
        const rev1 = setdefault.lazy(map, sink, newMap)
        const rev = setdefault.lazy(rev1, src, newMap)
        // now forward(srcObj) = sinkObj
        // and rev(sinkObj) = srcObj

        // feed changes from src to sink
        debug('making new listeniner src=%s sink=%s', src.name, sink.name)
        const listener = (pg, delta) => {
          debug('Change %s -> %s', src.name, sink.name)
          debug(' delta %o', delta)
          debug('  forward %o', forward)
          debug('  rev     %o', rev)
          let sinkHandle = forward.get(pg)
          if (sinkHandle === undefined) {
            debug('no sinkHandle yet, need to create')
            sinkHandle = sink.create()
            forward.set(pg, sinkHandle)
            rev.set(sinkHandle, pg)
          } else {
            debug('sinkHandle already exists; reusing %o', sinkHandle)
          }
          // we should flag this as now headed DOWNSTREAM, and it shouldn't
          // turn around and head UPSTREAM.  Or something like that.  This
          // will be a problem if there's a delay, as it'll change values
          // back, and then loop.
          debug('setProperty %o %O', sinkHandle, delta)
          sink.setProperty(sinkHandle, delta.property, delta.value)
        }
        src.listenSince(0, 'change', listener)
        this.listens.push([src, listener])
      }
    }
  }

  stop () {
    for (const [obj, func] of this.listens) {
      obj.off('change', func)
    }
  }
}

/*
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
      *./

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
*/

module.exports.Bridge = Bridge

// DIFFERENT OBJECT in JS?

// I guess the bridge needs to map NxM
