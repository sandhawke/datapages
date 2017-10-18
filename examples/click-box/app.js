'use strict'

const datapages = require('datapages')

const db = new datapages.Remote(window.serverAddress)

const body = document.getElementById('app')
body.innerHTML = `<div>
<button id="create">Create Box</button>
</div>`

const status = document.createElement('div')
body.appendChild(status)
status.style.position = 'absolute'

const create = document.getElementById('create')
create.onclick = function (ev) {
  db.create({
    isBox: true,
    started: new Date(),
    top: 100 + Math.random() * 500,
    left: Math.random() * 500,
    rgb: [ 50 + Math.round(Math.random() * 200),
      50 + Math.round(Math.random() * 200),
      50 + Math.round(Math.random() * 200) ]
  })
}

const boxes = db.view(
  {filter:
  {isBox: true,
    top: {required: true},
    left: {required: true},
    rgb: {required: true}
  }})

boxes.listenSince(0, 'appear', (page, delta) => {
  // console.log('appear', page, delta)
  status.innerHTML = '<pre>Delta: ' + JSON.stringify(delta, null, 2) + '</pre>'
  let box = page.__box
  if (!box) {  // 'appear' events are allowed to be duplicated
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
      console.log('DELETE', page)
      db.delete(page)
    })
    // could do a drag-watcher, too...
    box.innerHTML = '<p>created by session ' + (delta.who || db.sessionID) + '</p><p>anyone can click to close</p>'
  }
})

boxes.listenSince(0, 'change', (page, delta) => {
  let box = page.__box
  if (box) {
    box.style.top = '' + page.top + 'px'
    box.style.left = '' + page.left + 'px'
    const [red, green, blue] = page.rgb
    box.style.background = `rgb(${red},${green},${blue})`
  }
})

boxes.on('disappear', page => {
  let box = page.__box
  box.style.display = 'none'
})
