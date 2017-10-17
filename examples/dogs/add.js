const datapages = require('datapages')

const [breed, name] = process.argv.slice(2)

if (name) {
  const db = new datapages.Remote({port: process.env.PORT || 1954})
  const dogs = db.view({filter: {isDog: true}})
  dogs.create({isDog: true, breed, name})
  // save ?
  setTimeout(() => { db.close() }, 100)
} else {
  console.error('usage:  <breed> <name>')
}
