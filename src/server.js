const koaRouter = require('koa-router')
const ld = require('lodash')
const parseBody = require('koa-bodyparser')
const Koa = require('koa')

module.exports = {
  createLocalServer(bishop, config, instances = {}) {
    const { router = koaRouter(), koa } = instances

    // transport endpoint: search route locally and return result
    router.post('/bishop', async ctx => {
      const message = Object.assign({}, ctx.request.body, {
        // should search only in local routes
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

    const app = koa ? koa : new Koa()
    app.use(parseBody())

    // start new instance if none passed
    if (!koa) {
      app.use(router.routes()).use(router.allowedMethods())
      app.listen(config.port)
    }
    return { app, router }
  }
}
