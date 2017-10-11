'use strict'

const datapages = require('datapages')
const db = new datapages.Remote(window.serverAddress)

document.body.innerHTML = `<div>
<p>Name: <input type="text" id="name"></p>

<p>Recently seen users:</p>
<ol id="users"></ol>

<p>Say: <input type="text" id="compose"></p>

Messages:<div id="messages">.</div>
</div>`

const me = db.create({
  chatting: true
})

const users = document.getElementById('users')
const compose = document.getElementById('compose')
const messages = document.getElementById('messages')
const name = document.getElementById('name')
name.oninput = function () {
  me.name = this.value
}

compose.onkeypress = function (ev) {
  if (ev.code === 'Enter') {
    db.create({
      isMessage: true,
      text: this.value
    })
    this.value = ''
  }
}


const status  = document.createElement('div')
document.body.appendChild(status)


db.listenSince(0, 'change', (page, delta) => {
  status.innerHTML = '<pre>Delta: ' + JSON.stringify(delta, null, 2) + '</pre>'
})

const usersById = new Map()

const v = db.view({filter: {chatting: true}})
v.listenSince(0, 'change', (page, delta) => {
  if (!page.__e) {
    page.__e = document.createElement('li')
    users.appendChild(page.__e)
    usersById.set(delta.who, page)
  }
  let text = 'user: ' + (page.name ? page.name : '<em>anon</em>') + delta.who
  if (page === me) {
    text += ' (you)'
  }
  page.__e.innerHTML = text
})

db.view({filter: {isMessage: true}})
  .listenSince(0, 'change', (page, delta) => {
    console.log('x')
    if (!page.__e) {
      page.__e = document.createElement('p')
      messages.insertBefore(page.__e, messages.firstChild)
    }
    let text = 'msg: ' + page.text + ' ( ' + usersById.get(delta.who).name + ' - ' + delta.when + ' )'
    page.__e.innerHTML = text
  })


