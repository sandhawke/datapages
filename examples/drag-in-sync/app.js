'use strict'

const datapages = require('datapages')

const debug = require('debug')('datapages_example_pinboard')
localStorage.debug = '*'
debug('debugging')

const db = new datapages.Remote(window.serverAddress)

document.body.innerHTML = '<div></div>'

const me = db.create({
  runningAt: document.location.href,
  started: new Date(),
  text: navigator.userAgent + '<br />' + new Date()
})

// count up users first...?  ask for name?
// drag?

db.listenSince(0, 'change', (page, delta) => {
  debug('change: %o %o', page, delta)
  if (page.mouseAt && page.text) {
    const [x, y] = page.mouseAt
    if (!page.__element) {   // leading "__" make is private for us
      page.__element = document.createElement('div')
      document.body.appendChild(page.__element)
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
