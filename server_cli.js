const datapages = require('.')

async function main () {
  const server = new datapages.Server({port: 6001})
  await server.start()
}

main()
