'use strict'

const datapages = require('datapages')
const browserify = require('browserify')
const launcher = require('james-browser-launcher')
const path = require('path')

async function start () {
  const dps = new datapages.Server({db: new datapages.MinDB(),
                                    port: process.env.PORT || 1978})

  dps.db.on('change', (page, delta) => {
    console.log('page changed %o', delta)
  })

  const server = dps.transport
  server.app.get('/', root)
  server.app.get('/:app/', app)
  server.app.get('/:app/bundle.js', js)

  await server.start()

  launcher((err, launch) => {
    if (err) throw err
    launch(server.siteURL, 'firefox', (err, instance) => {
      if (err) throw err
    })
    launch(server.siteURL, 'chrome', (err, instance) => {
      if (err) throw err
    })
  })

  function root (req, res) {
    res.send(
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Datapages Demo</title>
</head>
<body>
<p><a href="drag-in-sync/">drag-in-sync</a></p>
</body>`)
  }
  
  function app (req, res) {
    res.send(
      `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Demo ${req.params.app}</title>
<script type="text/javascript">
window.serverAddress='${server.address}'
console.log('# running datapages demo, server=', window.serverAddress
)
</script>
</head>
<body>
<p>loading demo...</p>
<script type="text/javascript" src="bundle.js"></script>
</body>`)
  }

  function js (req, res) {
    const appjs = browserify(path.join(__dirname, req.params.app, 'app'))
    appjs.bundle().pipe(res)
  }
}

start()
