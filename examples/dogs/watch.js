const datapages = require('datapages')

const db = new datapages.Remote({port: 1954})

const dogs = db.view({
  filter: {
    isDog: true,
    name: {required: true},
    breed: {required: true}
  }
})

dogs.listenSince(0, 'appear', dog => {
  console.log('Found a dog! ', dog)
  dog.on('change', (page, delta) => {
    console.log('  change: ', dog.name, delta.property, '=', delta.value)
  })
})
