'use strict'

const datapages = require('datapages')
const browserify = require('browserify')
const launcher = require('james-browser-launcher')
const path = require('path')

async function start () {
  const appjs = browserify(path.join(__dirname, 'app'))

  const dps = new datapages.Server({port: process.env.PORT})

  dps.db.on('change', (page, delta) => {
    console.log('page changed %o', delta)
  })

  const server = dps.transport
  server.app.get('/', app)
  server.app.get('/bundle.js', js)

  await server.start()

  launcher((err, launch) => {
    if (err) throw err
    launch(server.siteURL, 'firefox', (err, instance) => {
      if (err) throw err
    })
  })

  function app (req, res) {
    res.send(
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Testing</title>
<script type="text/javascript">
window.serverAddress='${server.address}'
console.log('# running datapages demo, server=', window.serverAddress
)
</script>
<script type="text/javascript" src="/bundle.js"></script>
</head>
<body>
<p>loading demo app from ${__dirname}</p>
</body>`)
  }

  function js (req, res) {
    appjs.bundle().pipe(res)
  }
}

start()
