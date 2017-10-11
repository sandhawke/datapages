'use strict'

/*

  factor out common stuff from test-basics

  using some flags on the makers
    .needsFilesystem
    .needsServer

  and ClientToReadyServer is a .needsServer
  and should also do  transport.ask.resetState()

*/

// NOT meant to be run directly, which is why the name doesn't start with
// test-
//
// Instead, let "test-in-browser.js" run this via browserify

const test = require('tape')
const datapages = require('..')
const runTests = require('./basic-tests')
// const debug = require('debug')('datapages_inbrowser')

window.localStorage.debug = '*'

const makers = [
  MinDB,
  InMem,
  ClientToReadyServer
]

async function MinDB () {
  return new datapages.MinDB()
}

async function InMem () {
  return new datapages.InMem()
}

async function ClientToReadyServer () {
  console.log('# CTRS running', window.serverAddress)
  return new datapages.RawClient(window.serverAddress, {useSessions: false})
}

for (const maker of makers) runTests(test, maker)
