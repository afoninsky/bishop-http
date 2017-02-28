const { test } = require('ava')
const Bishop = require('bishop')
const request = require('request-promise')
const transport = require(process.env.PWD)

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

test.todo('ensure timeouts are inherited')

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
