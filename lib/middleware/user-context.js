'use strict'

const debug = require('debug')('loopback:component:access:context')
const Promise = require('bluebird')
const LoopBackContext = require('loopback-context')

module.exports = function userContextMiddleware() {
  debug('initializing user context middleware')
  // set current user to enable user access for remote methods
  return function userContext(req, res, next) {
    const loopbackContext = LoopBackContext.getCurrentContext({ bind: true })

    next = loopbackContext.bind(next)

    if (!loopbackContext) {
      debug('No user context (loopback current context not found)')
      return next()
    }

    if (!req.accessToken) {
      debug('No user context (access token not found)')
      return next()
    }

    const { app } = req
    const UserModel = app.accessUtils.options.userModel || 'User'

    return Promise.join(
      app.models.SystemAccess.count({roleId: 'adminRoleID',principalType:'USER', principalId: req.accessToken.userId}),
      app.models[UserModel].findById(req.accessToken.userId,{fields:{profile:false}}),
      app.accessUtils.getUserGroups(req.accessToken.userId),
      (admin,user, groups) => {
        if (!user) {
          return next(new Error('No user with this access token was found.'))
        }
        user.__data.isAdmin = admin>0;
        loopbackContext.set('currentUser', user)
        loopbackContext.set('currentUserGroups', groups)
        debug('currentUser', user)
        debug('currentUserGroups', groups)
        return next()
      })
      .catch(next)
  }
}
