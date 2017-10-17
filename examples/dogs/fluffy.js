// BEWARD: THIS TEXT IS INCLUDED USING LINE NUMBERS IN api.adoc
const datapages = require('datapages')
const db = new datapages.Remote({port: process.env.PORT || 1954})

db.create({
  isDog: true,
  name: 'Fluffy',
  owner: { name: 'Hagrid' },
  heads: 3,  // and yet still, they call it a dog!
  born: new Date('July 15, 1976'), // not in canon
  weaknesses: [ { description: 'music induces sleep' } ]
})

// With create, we don't have a way to know when durable
// In general, one should use await db.overlay(fluffy, {...}) instead
// OR maybe we should add ondurable as a second argument to create?
setTimeout(() => db.close(), 100)
