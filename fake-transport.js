'use strict'

// lets us pretend we're using webgram when we're just in memory

const EventEmitter = require('eventemitter3')

class Server extends EventEmitter {

  connectedClient () {
    const client = new Client()
    const conn = new Connection()

    conn.send = (...args) => {
      client.emit(...args)
    }

    client.send = (...args) => {
      this.emit(args[0], conn, args.slice(1))
      conn.emit(...args)
    }
    
    this.emit('$session-active', conn)
    this.emit('$connect', conn)

    return client
  }
}

class Connection extends EventEmitter {
}

class Client extends EventEmitter { }

module.exports.Server = Server
