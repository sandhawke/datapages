
A small, fast, and powerful tool for maintain distributed/synchronized
data, suitable for use in webapps.

Client code instantiates datapages.Remote() which connects to the
server and gives a read/write view of a shared set of "pages" (aka
"documents" or "objects" or "records").  Changes propagate quickly and
persist on the server. Currently full change history is maintained by
the default server.

API style takes some inspriration from my earlier
[crosscloud.js](https://github.com/sandhawke/crosscloud.js/blob/master/doc/planned-api.md)


## Example

See the examples and test directories for complete examples.  Try
```sh
node example/demo-server.js
```

Basic idea is something like this: (see examples/dogs)

```js
const datapages = require('datapages')

const db = datapages.Remote()

const dogs = db.view({filter: {isDog: true}})
dogs.on('appear', dog => {
  console.log('Found a dog! ', dog)
})

db.create({
  isDog: true,
  name: 'Fluffy',
  owner: { name: 'Hagrid' },
  heads: 3,  // and yet still, they call it a dog!
  born: new Date('July 15, 1976'), // not in canon
  weaknesses: [ { description: 'music induces sleep' } ]
})
```

See [API Documentation](https://sandhawke.github.io/datapages/docs/api.html)

## Features

* Very fast for small datasets (thousands of records)
* Data records are JSON-compatible JavaScript objects
* Objects can refer to each other naturally (like `alice.mother.mother.age`, cycles are okay)
* Instances can be linked into a federation (eg between web client and web server), with efficient propagation
* Easy to build live displays of dynamically-changing query results (no
polling)
* Change (delta) log is available for displaying history and provenance
* (TODO) Supports temporal and provenance features (only show data resulting from sources a and b before time t)
* (TODO) Supports transient records, aka event streaming
* (TODO) Supports access control for use in multiuser backends
* (TODO) Works with https://github.com/sandhawke/vocabspec[vocabspec] or https://github.com/sandhawke/data-sentence[data sentence]
to handle schema validation, migration (with views), and integration
* (TODO) Coordinate with a media server

## Tests

The testing setup has gotten pretty complicated, as I tried to factor
common stuff out of my `tape` tests.  `npm test` should run all the
tests in node and whatever versions of firefox and chromium you have
installed.  The tests involve starting up a lot of servers and
connecting to them with clients, some of the clients being in the
browser.

```shell
$ npm test


test/test-bridge.js ................................. 12/12
test/test-db.js ..................................... 42/42
test/test-filter.js ................................. 37/37
test/test-groupby.js .................................. 1/1 258ms
test/test-listen.js ................................. 21/21
test/test-session.js .................................. 3/3
test/test-store.js .................................... 9/9 8s
test/test-view.js ................................... 22/22
test/test-wait-for-property.js ...................... 35/35
test/browser-test.js .............................. 330/330
total ............................................. 512/512

  512 passing (22s)

  ok
```

There's a fair amount of magic in test/setup.js and
test/browser-test.js (which uses webgram/browser-tester).

For debugging a failing test, focus in on it with:
* run test file with `node` instead of `tap`, so you see the output
* restrict which browsers are used, in browser-test.js
* restrict which test files are used in browser-test.js
* turn debugging on with DEBUG env var (as per `npm docs debug`)
* restrict which "testing setup" to use (of the many defined in test/setup.js), with SETUP env var, which can be one of the names shown with DEBUG=... in the test output, or the number of that setup in sequence
* change test.multi(...) to test.multi.only(...) in the test file itself

So you end up with something like:

```shell
$ DEBUG=*,-web* SETUP=7 node test/test-view.js
```

If that setup isn't supported for that test, it wont run any test.

If the debugging output is large, and it's not clear which modules to
turn off, I sometimes run it inside an emacs "shell" window, which has
better search than my terminal (while still having the output
colorized).

## Credits and Disclaimer

This material is based upon work supported by the National Science
Foundation under Grant No. 1313789.  Any opinions, findings, and
conclusions or recommendations expressed in this material are those of
the author(s) and do not necessarily reflect the views of the National
Science Foundation.
