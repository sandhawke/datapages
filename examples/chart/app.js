'use strict'

const c3 = require('c3')
const datapages = require('datapages')

const db = new datapages.Remote(window.serverAddress)

const body = document.getElementById('app')
body.innerHTML = `<div>
<button id="create">Create Box</button>
</div>`

const status  = document.createElement('div')
body.appendChild(status)
status.style.position = 'absolute'

// watch to see new properties?

const samples = db.view(
  {painter,
   filter:
   {time: {required: true}} 
  })

// painter is called with iterable, never overlapping, not too often,
// after data hasn't changed in a little while
function painter (pages) {
  
}

samples.listenSince(0, 'appear', (page, delta) => {
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
    box.innerHTML = '<p>created by session ' + (delta.who || db.sessionData.id) + '</p><p>anyone can click to close</p>'
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
