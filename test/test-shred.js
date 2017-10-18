/*

This is about how you can

 - setProperty with a value that's an object (and/or contains objects)
   and it seemingly does the right thing, db.creating all these
   objects, linked in the same way.    {ref: objid}

 - when you look at the value of a property, by being handed a proxy,
   you get the proxy for the referenced object.   It MAY NOT be fully
   materialized yet, though (unless view required it).

 - So you can:

   await db.waitForValue(obj, prop, timeoutMS, default)
   (timeoutMS = 0 will resolve synchronously, null will never timeout,
   undefined is default which is 1000)

   to get the value of that property when it arrives.  If that value
   is an array, it'll be filled in when it arrives.

   db.valueReady(obj, prop)   t/f

 */
