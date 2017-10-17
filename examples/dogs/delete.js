const datapages = require('datapages')

const [name] = process.argv.slice(2)

if (name) {
  const db = new datapages.Remote({port: process.env.PORT || 1954})
  const target = db.view({filter: {isDog: true, name}})
  target.once('appear', page => {
    db.delete(page)
  })
  // save ?
  setTimeout(() => { db.close() }, 100)
} else {
  console.error('usage:  <name>')
}
