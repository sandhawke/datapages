
A small, fast, and powerful took for maintain distributed/synchronized
data, suitable for use in webapps.

Client code instantiates datapages.Remote() which connects to the
server and gives a read/write view of a shared set of "pages" (aka
"documents" or "objects" or "records").  Changes propagate quickly and
can optionally persist on the server.

API style takes some inspriration from
[crosscloud.js](https://github.com/sandhawke/crosscloud.js/blob/master/doc/planned-api.md)

## Example

This is a normal API to use.  You can also use the Raw API, if the
overhead of proxies isn't appropriate for your application.

```js
const datapages = require('datapages')

const db = datapages.Remote()

db.create({isDog: true, })

const dogs = db.view({filter: {isDog: true}})
dogs.listenSince(0, 'appear', dog => {
  console.log('Found a dog! ', dog)
})

See [API Documentation](api.html) and [API Ideas](api-ideas.html)

