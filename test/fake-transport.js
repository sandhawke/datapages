'use strict'

// lets us pretend we're using webgram when we're just in memory

const EventEmitter = require('eventemitter3')

let connectionCounter = 0

class Server extends EventEmitter {
  connectedClient () {
    const client = new Client()
    const conn = new Connection()

    conn.sessionData = {
      _sessionID: ++connectionCounter
    }
    conn.sessionData.id = conn.sessionData._sessionID
    client.sessionData = conn.sessionData

    conn.send = (...args) => {
      client.emit(...args)
    }

    client.send = (...args) => {
      this.emit(args[0], conn, ...args.slice(1))
      conn.emit(...args)
    }

    // client.transport = {}
    client.sessionData = {
      id: 1
    }

    this.emit('$session-active', conn)
    this.emit('$connect', conn)

    return client
  }

  start () {}

  close () {}
}

class Connection extends EventEmitter {
}

class Client extends EventEmitter {
  close () {}

  async waitForSession () {

  }
}

module.exports.Server = Server
