'use strict'

module.exports.Server = require('./server').Server
module.exports.DB = require('./client').DB

module.exports.InMem = class extends module.exports.DB {
  constructor (options = {}) {
    options.localMode = true
    super(options)
  }
}
