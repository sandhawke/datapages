'use strict'

const test = require('tape')
const IDMapper = require('./idmapper')

test(t => {
  const mapper = new IDMapper()

  const alice = { name: 'alice' }
  const bob = { name: 'bob' }
  const cassia = { name: 'cassia' }

  t.equal(mapper.fromContext(alice, -5).intoContext(alice), -5)
  t.equal(mapper.fromContext(alice, -5).intoContext(bob), 1)
  t.equal(mapper.fromContext(alice, -5).intoContext(cassia), 1)

  t.equal(mapper.fromContext(bob, 'hello').intoContext(cassia), 2)
  t.equal(mapper.fromContext(bob, 'hello').intoContext(alice), 2)
  t.equal(mapper.fromContext(bob, 'hello').intoContext(bob), 'hello')

  t.equal(mapper.fromContext(cassia, 1).intoContext(alice), -5)
  t.equal(mapper.fromContext(cassia, 2).intoContext(bob), 'hello')
  t.equal(mapper.fromContext(cassia, 2).intoContext(cassia), 2)

  try {
    mapper.fromContext(cassia, 3)
    t.fail()
  } catch (e) {
    t.pass()
  }

  t.end()
})

test('mapTree', t => {
  const mapper = new IDMapper()

  const alice = { name: 'alice' }
  const neutral = { name: 'neutral' }

  const tree = [ 1, 'hello', null, [
    2, { ref: -5 }, 3,
    5, { ref: 'hello' }]]

  const t2 = mapper.mapTree(alice, neutral, tree)
  const t3 = mapper.mapTree(neutral, alice, t2)

  // console.log('tree', tree)
  // console.log('tree2', t2)
  // console.log('tree3', t3)

  t.notDeepEqual(tree, t2)
  t.deepEqual(t3, tree)

  t.end()
})

test('mapTree', t => {
  const mapper = new IDMapper()

  const alice = { name: 'alice' }
  const neutral = { name: 'neutral' }

  const tree = [ 1, 'hello', null, [
    2, { ref: -5 }, 3,
    5, { ref: 'hello' }]]

  const t2 = mapper.mapTree(alice, neutral, tree)
  const t3 = mapper.mapTree(neutral, alice, t2)

  // console.log('tree', tree)
  // console.log('tree2', t2)
  // console.log('tree3', t3)

  t.notDeepEqual(tree, t2)
  t.deepEqual(t3, tree)

  t.end()
})
