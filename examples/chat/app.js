'use strict'

const datapages = require('datapages')
const setdefault = require('setdefault')
const db = new datapages.Remote(window.serverAddress)

document.body.innerHTML = `<div>
<p>Your Nick: <input type="text" id="name"></p>

<p>Recently seen users:</p>
<ol id="users"></ol>

<p>Say: <input type="text" id="compose"></p>

Messages:<div id="messages">.</div>
</div>`

const me = db.create({
  chatting: true,
  now: new Date()
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

const merge = (id) => {
  const ul = []
  const versions = usersById.get(id)
  // console.log('versions:', versions)
  if (versions) {
    for (const p of versions) {
      ul.push([p.now, p])
    }
    ul.sort()
    ul.reverse()
    let answer
    while (true) {
      answer = ul.shift()
      // console.log('considering', answer)
      if (!answer) return undefined
      if (answer[1].name) return answer[1]
    }
  }
  return undefined
}

const nm = (id, def) => {
  const m = merge(id)
  if (m && m.name) {
    return m.name
  }
  return def
}

let id

const v = db.view({filter: {chatting: true}})
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

db.view({filter: {isMessage: true}})
  .listenSince(0, 'change', (page, delta) => {
    console.log('x')
    if (!page.__e) {
      page.__e = document.createElement('span')
      messages.insertBefore(page.__e, messages.firstChild)
    }
    let tm = ''
    if (!delta.when) delta.when = new Date()
    tm = delta.when.toISOString().slice(11,19)
    const who = nm(delta.who || id, 'anon')
    let text = tm + ': &lt;' + (who || '_anon_') + '> ' + (page.text || '') + '<br>'
    console.log(text)
    page.__e.innerHTML = text
  })


