'use strict'

const datapages = require('datapages')
// const setdefault = require('setdefault')
// const debug = require('debug')

const db = new datapages.Remote(window.serverAddress)

const body = document.getElementById('app')
body.innerHTML = `<div>
<div id="pusers" style="float: right"></div>

<p>Your Nick: <input type="text" id="name"></p>

<p>Say: <input type="text" id="compose"></p>

Messages:<div id="messages">.</div>
</div>`

const nm = (page, def) => {
  if (page && page.chatName) return page.chatName
  return def
}

/*
const me = db.create({
  chatting: true,
  now: new Date()
})
*/

const pusers = document.getElementById('pusers')
const compose = document.getElementById('compose')
const messages = document.getElementById('messages')
const name = document.getElementById('name')

name.oninput = function () {
  db.sessionData.chatName = this.value
}

db.waitForSessionProperty('chatName', null).then(chatName => {
  console.log('chat name available:', chatName)
  name.value = chatName
  db.sessionData.on('change', page => {
    console.log('sessionData changed!')
    name.value = page.chatName
  })
})

compose.onkeypress = function (ev) {
  if (ev.code === 'Enter') {
    db.create({
      isMessage: true,
      text: this.value
    })
    this.value = ''
  }
}

const status = document.createElement('div')
body.appendChild(status)

db.listenSince(0, 'change', (page, delta) => {
  status.innerHTML = '<pre>Delta: ' + JSON.stringify(delta, null, 2) + '</pre>'
})

// const usersById = new Map()

/*
const nm = (id, def) => {
  const m = merge(id)
  if (m && m.name) {
    return m.name
  }
  return def
}
*/

// let id

const who = db.view({
  filter: {
    _isSession: true,
    chatName: {required: true}
  }
})
who.on('stable', paintUserList)

/*
const v = db.view({filter: {chatting: true}})
// v.on('stable', paintUserList)
v.listenSince(0, 'change', (page, delta) => {
  if (db.sessionData) id = db.sessionData.id

  // console.log(delta)
  if (!page.__seen) {
    if (!delta.who) delta.who = id
    // if (!delta.who) return
    setdefault(usersById, delta.who, new Set()).add(page)
  }

  if (delta.who === id) {
    name.value = nm(id, name.value)
  }

  let text = 'conn? = ' + JSON.stringify(db.sessionData.id)

  for (const [xid] of usersById) {
    // text += `<pre>id=${id} name=${JSON.stringify(merge(id))}</pre><br>\n`
    text += `<pre>id=${xid} name=${nm(xid, 'anon')}</pre><br>\n`
  }

  users.innerHTML = text
  // let text = 'user: ' + (page.name ? page.name : '<em>anon</em>') + delta.who
  // if (page === me) {
  // text += ' (you)'
  // }
  })
*/

// If we do this without waiting for a tick, we'll probably see the
// users names at the time they sent the messages, because this will
// be handled on the first run-through.

setTimeout(renderMessages, 0)
// renderMessages()

function renderMessages () {
  db.view({filter: {isMessage: true}})
  .listenSince(0, 'change', (page, delta) => {
    if (!page.__e) {
      page.__e = document.createElement('span')
      messages.insertBefore(page.__e, messages.firstChild)
    }
    let tm = ''
    if (!delta.when) delta.when = new Date()
    tm = delta.when.toISOString().slice(11, 19)

    const who = db.proxyFor(page._owner).chatName + ' (session ' + delta.who + ')'
    let text = tm + ' &lt;' + (who || '_anon_') + '> ' + (page.text || '') + '<br>'
    // console.log(text)
    page.__e.innerHTML = text
  })
}

function paintUserList (who) {
  // look to see who really has an active connection?

  pusers.style.border = '1px solid #ddd'
  pusers.style.borderRight = 'none'
  pusers.style.padding = '0.5em'
  // console.log('users', Array.from(who))
  function map (x) {
    return nm(x, '? anon') /* + ' (session ' + x._owner+ */ + '<br>'
  }
  pusers.innerHTML = '<b>Sessions</b><br><hr>' +
    Array.from(who).map(map).join('')
}
