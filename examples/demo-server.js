'use strict'

const datapages = require('datapages')
const browserify = require('browserify')
const launcher = require('james-browser-launcher')
const path = require('path')
const glob = require('glob')

async function start () {
  const dps = new datapages.Server({db: new datapages.MinDB(),
                                    port: process.env.PORT || 1978})

  dps.db.on('change', (page, delta) => {
    console.log('page changed %o', delta)
  })

  const server = dps.transport
  server.app.get('/', app)
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

  function app (req, res) {
    glob("*/app.js", function (err, files) {
      if (err) throw err
      const apps = files.map(x => x.replace(/\/app.js/, ''))
      const app = req.params.app
      let script = ''
      let msg = ''
      if (app) {
        script = '<script type="text/javascript" src="bundle.js"></script>'
        msg = 'loading ' + app
      } else {
        msg = 'select a demo app'
      }
      
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
<p>Demos: ${apps.map(x => `<a href="/${x}/">${x}</a>`).join(' · ')}</p>
<hr />
<div id="app">
<p>${msg}</p>
</div>
${script}
</body>`)
    })
  }

  function js (req, res) {
    try {
      const appjs = browserify(path.join(__dirname, req.params.app, 'app'))
      appjs.bundle().on('error', function (err) {
        console.error('CAUGHT ERROR', err)
        res.set('Content-Type', 'application/javascript');
        res.send('alert("error packaging app")')
        this.emit('end')
      }).pipe(res)
      // appjs.bundle().pipe(res)
    } catch (e) {
      console.err(e)
      res.set('Content-Type', 'application/javascript');
      res.send('alert("error packaging app")')
    }
  }
}

start()
