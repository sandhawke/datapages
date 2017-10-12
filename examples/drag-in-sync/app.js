'use strict'

const datapages = require('datapages')

const debug = require('debug')('datapages_example_pinboard')
localStorage.debug = ''   // debugging slows it down a lot
debug('debugging')

const db = new datapages.Remote(window.serverAddress)
const body = document.getElementById('app')
body.innerHTML = '<div>(loading data)</div>'

const status  = document.createElement('div')
body.appendChild(status)

const me = db.create({
  runningAt: document.location.href,
  started: new Date(),
  text: navigator.userAgent + '<br />' + new Date()
})

// count up users first...?  ask for name?
// drag?

db.listenSince(0, 'change', (page, delta) => {
  status.innerHTML = '<pre>Delta: ' + JSON.stringify(delta, null, 2) + '</pre>'
  debug('change: %o %o', page, delta)
  if (page.mouseAt && page.text) {
    const [x, y] = page.mouseAt
    if (!page.__element) {   // leading "__" make is private for us
      page.__element = document.createElement('div')
      body.appendChild(page.__element)
    }
    page.__element.innerHTML = page.text
    page.__element.style.position = 'absolute'
    page.__element.style.left = `${x}px`
    page.__element.style.top = `${y}px`
  }
})

addEventListener('mousemove', ev => {
  me.mouseAt = [ev.clientX, ev.clientY]
})
