'use strict'

const datapages = require('datapages')

const debug = require('debug')('datapages_example_pinboard')
localStorage.debug = ''   // debugging slows it down a lot
debug('debugging')

const db = new datapages.Remote(window.serverAddress)

const body = document.getElementById('app')
body.innerHTML = `<div>
<button id="create">Create Box</button>
</div>`

const status  = document.createElement('div')
body.appendChild(status)
status.style.position = 'absolute'

const create = document.getElementById('create')
create.onclick = function (ev) {
  const rec = db.create({
    isBox: true,
    started: new Date(),
    top: 100 + Math.random() * 500,
    left: Math.random() * 500,
    rgb: [ 50 + Math.round(Math.random() * 200),
           50 + Math.round(Math.random() * 200),
           50 + Math.round(Math.random() * 200) ]
           
  })
}

db.view({filter: {isBox: true,
                  top: {required: true},
                  left: {required: true},
                  rgb: {required: true}
                 }})
  .listenSince(0, 'change', (page, delta) => {
    console.log('delta', page, delta)
    status.innerHTML = '<pre>Delta: ' + JSON.stringify(delta, null, 2) + '</pre>'
    let box = page.__box
    if (!box) {
      box = document.createElement('div')
      box.style.padding = '1em'
      box.style.width = '200px'
      box.style.height = '200px'
      box.style.border = '1px solid black'
      box.style.position = 'absolute'
      page.__box = box
      console.log('created box', box, page)
      body.appendChild(box)
      box.addEventListener('click', ev => {
        page.clicked = true
        console.log(ev)
      })
      box.innerHTML = '<p>created by session ' + (delta.who || db.sessionData.id) + '</p><p>anyone can click to close</p>'
    }
    box.style.top = '' + page.top + 'px'
    box.style.left = '' + page.left + 'px'
    const [red, green, blue] = page.rgb
    box.style.background = `rgb(${red},${green},${blue})`
    if (page.clicked) {
      box.style.display = 'none'
      box.style.background = 'white'
      box.width = '100px'
      box.height = '100px'
    }
  })

/*
addEventListener('mousemove', ev => {
  me.mouseAt = [ev.clientX, ev.clientY]
})
*/
