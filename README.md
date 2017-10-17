
A small, fast, and powerful tool for maintain distributed/synchronized
data, suitable for use in webapps.

Client code instantiates datapages.Remote() which connects to the
server and gives a read/write view of a shared set of "pages" (aka
"documents" or "objects" or "records").  Changes propagate quickly and
can optionally persist on the server.

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

db.create({
  isDog: true,
  name: 'Fluffy',
  owner: { name: 'Hagrid' },
  heads: 3,  // and yet still, they call it a dog!
  born: new Date('July 15, 1976'), // not in canon
  weaknesses: [ { description: 'music induces sleep' } ]
})

const dogs = db.view({filter: {isDog: true}})
dogs.on('appear', dog => {
  console.log('Found a dog! ', dog)
})
```

See [API Documentation](https://sandhawke.github.io/datapages/docs/api.html)

