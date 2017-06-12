const koaRouter = require('koa-router')
const ld = require('lodash')
const parseBody = require('koa-bodyparser')
const Koa = require('koa')

module.exports = {

  createLocalServer(bishop, config, instances = {}) {
    const router = instances.router || koaRouter()

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

    const app = instances.koa || new Koa()
    app
      .use(parseBody()) // extract body variables into req.body
      .use(router.routes())
      .use(router.allowedMethods())

    app.listen(config.listenPort)
    return { app, router }
  }
}
