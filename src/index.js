const request = require('request-promise')
const ld = require('lodash')
const { createLocalServer } = require('./server')

const defaultOptions = {
  name: 'http',                         // client/server: transport name/alias
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
  const defaultTimeout = config.timeout || bishop.config.timeout || 10000

  // act as server library: start listen request and response to it
  if (config.listenPort) {
    createLocalServer(bishop, config)
  }

  const methods = {}

  if (config.remote) {

    const client = request.defaults(ld.defaults({}, {
      baseUrl: config.remote,
      json: true
    }, config.request))

/**
 * Send events into remote system and return result
 */
    methods.request = (message, headers) => {
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
    }
  }

  bishop.register('transport', config.name, methods, config)
}
