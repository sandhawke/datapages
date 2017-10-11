'use strict'

const datapages = require('datapages')

const debug = require('debug')('datapages_example_pinboard')
window.localStorage.debug = '*'
debug('debugging')

const db = new datapages.Remote(window.serverAddress)

document.body.innerHTML = '<div><div id="marker">Hello</div></div>'
const marker = document.getElementById('marker')

db.listenSince(0, 'change', (page, delta) => {
  debug('change: %o %o', page, delta)
  if (page.mouseAt) {
    const [x, y] = page.mouseAt
    marker.style.position = 'absolute'
    marker.style.left = `${x}px`
    marker.style.top = `${y}px`
  }
})

db.create({
  runningAt: document.location.href,
  started: new Date()
})

addEventListener('mousemove', ev => {
  db.create({mouseAt: [ev.clientX, ev.clientY]})
})

// change to using updates!
