const { test } = require('ava')
const Bishop = require('bishop')
const request = require('request-promise')
const transport = require(process.env.PWD)
const Promise = require('bluebird')

test('default answer', async t => {
  const bishop = new Bishop()
  await bishop.use(transport, {
    name: 'test',
    defaultResponse: {
      some: 'data'
    },
    listenPort: 9001
  })
  const res = await request('http://localhost:9001')
  const exp = JSON.stringify({ some: 'data', name: 'http' })
  t.deepEqual(res, exp)
})

test('client-server interaction', async t => {
  const bishopServer = new Bishop()
  const bishopClient = new Bishop()

  await bishopClient.use(transport, {
    name: 'http-client',
    remote: 'http://localhost:9002',
    pattern: 'some:stuff'
  })
  await bishopServer.use(transport, {
    name: 'http-server',
    listenPort: 9002,
  })
  bishopServer.add('some:stuff', () => 'hello')
  t.is(await bishopClient.act('some:stuff, with:stuff'), 'hello')
})

test('ensure timeouts are inherited', async t => {
  const bishopServer = new Bishop()
  const bishopClient = new Bishop({
    timeout: 100 // default timeout
  })
  await bishopServer.use(transport, {
    name: 'http-server',
    listenPort: 9004,
  })
  await bishopClient.use(transport, {
    timeout: 200, // redefine default timeout
    name: 'http-client',
    remote: 'http://localhost:9004',
    pattern: 'some:stuff'
  })
  bishopServer.add('some:stuff', async message => {
    await Promise.delay(message.delay || 0)
    return {
      timeout: parseInt(message.$timeout, 10)
    }
  })
  const res1 = await bishopClient.act('some:stuff')
  t.is(res1.timeout, 200, 'should rewrite default timeout')

  const res2 = await bishopClient.act('some:stuff, $timeout:201')
  t.is(res2.timeout, 201, 'should take timeout from query if set')

  const res3 = await bishopClient.act('some:stuff, delay:150')
  t.is(res3.timeout, 200, 'should use redefined timeout and not throw')

  t.throws(bishopClient.act('some:stuff, delay:210'))

})

test('handle remote error', async t => {
  const bishopServer = new Bishop()
  const bishopClient = new Bishop()

  await bishopClient.use(transport, {
    name: 'http-client',
    remote: 'http://localhost:9003',
    pattern: 'some:stuff'
  })
  await bishopServer.use(transport, {
    name: 'http-server',
    listenPort: 9003,
  })
  bishopServer.add('some:stuff', () => {
    throw new Error('user error')
  })

  t.throws(bishopClient.act('some:stuff, with:error'), /user error/)
})
