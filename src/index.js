const request = require('request-promise')
const ld = require('lodash')
const koaRouter = require('koa-router')
const parseBody = require('koa-bodyparser')
const Koa = require('koa')

const defaultOptions = {
  name: 'http',                         // client/server: transport name/alias
  pattern: null,                        // client ('http://localhost:9000')
  remote: null,                        // client: transport endpoint (9000)
  listenPort: null,                     // server: listen incoming requests on port
  timeout: null,                        // client/server: will take from default bishop instance if not specified
  request: {},                          // client: request-specific additional options: https://github.com/request/request#requestoptions-callback
  defaultResponse: {
    name: 'http'
  }
}

module.exports = (bishop, options = {}) => {
  const config = ld.defaultsDeep({}, options, defaultOptions)
  const { timeout, name, pattern, remote, listenPort } = config
  const defaultTimeout = timeout || bishop.config.timeout || 10000

  if (remote) {

    const client = request.defaults(ld.defaults({}, {
      baseUrl: remote,
      json: true
    }, config.request))

    // register transport so local client can send request to remote system
    bishop.register('remote', name, (message, headers) => {
      const { source } = headers
      const timeout = (source.$timeout || defaultTimeout) + 10
      return client({
        uri: '/bishop',
        method: 'POST',
        body: source,
        timeout
      }).catch(err => {
        const { response } = err
        // will handle only 400 error with correct json payload (from bishop-http client)
        if (response && response.statusCode === 400 && response.body.error) {
          let bodyErr = response.body.error
          if (typeof bodyErr === 'string') {
            throw new Error(bodyErr)
          }
          const err = new Error('unsupported error from remote server')
          for (let i in bodyErr) {
            err[i] = bodyErr[i]
          }
          throw err
        }
        throw err
      })
    }, config)

    // add pattern for routes into remote system (can be omitted)
    if (pattern) {
      bishop.add(pattern, name)
    }

  }

  // act as server library: start listen request and response to it
  if (listenPort) {
    const router = koaRouter()

    // index route: can be used for healthchecks
    router.get('/', ctx => {
      ctx.body = config.defaultResponse
    })

    // transport endpoint: search route locally and return result
    router.post('/bishop', async ctx => {
      const message = Object.assign({}, ctx.request.body, { // should search only in local routes
        $local: true
      })

      try {
        ctx.body = await bishop.act(message)
      } catch (err) {
        ctx.status = 400
        ctx.body = {
          error: ld.pick(err, ['name', 'message'])
        }
      }
    })

    const app = new Koa()
    app
      .use(parseBody()) // extract body variables into req.body
      .use(router.routes())
      .use(router.allowedMethods())

    app.listen(listenPort)
  }
}
