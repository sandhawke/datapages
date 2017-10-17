// BEWARD: THIS TEXT IS INCLUDED USING LINE NUMBERS IN api.adoc
const datapages = require('datapages')

const db = new datapages.Remote({port: 1954})

const dogs = db.view({
  filter: {
    isDog: true,
    name: {required: true},
    breed: {required: true}
  }
})

dogs.on('appear', dog => {
  console.log('Found a dog: ', dog.name, 'an', dog.breed)
  dog.on('change', (page, delta) => {
    console.log('  change: ', dog.name, delta.property, '=', delta.value)
  })
})
dogs.on('disappear', dog => {
  console.log('Dog gone! ', dog.name, 'an', dog.breed)
})
