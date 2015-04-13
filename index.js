/**
 * lib/index.js
 *
 * Defines the modeller object
 */

var localKnex = null;

var modeller = {
  /**
   * Initialization function initializes our instance of Knex to work with
   * whatever database we need it to.
   */
  connect: function(config) {
    var self = this;

    if (config.knex) {
      // config contains an explicit reference to a knex object
      // we assume it has been configured elsewhere
      localKnex = config.knex;
    } else {
      // make sure that we have user, password, host, and db
      var user = config.user,
        password = config.password,
        database = config.database,
        dialect = config.dialect,
        host = config.host || '127.0.0.1',
        port = config.port || 3306;

      if (!user || !password || !database || !dialect) {
        throw new Error('knex-modeller.connect() requires a configuration ' +
            'object which specifies user, password, database, and dialect.');
      } else {
        localKnex = require('knex')({
          dialect: dialect,

          connection: {
            user: user,
            password: password,
            database: database,
            host: host,
            port: port
          }
        });
      }

      /*
        After knex is instantiated, use it to create the Model class
       */
      self.Model = require('./lib/model.js')(localKnex);
    }
  },

  /**
   * Returns the working instance of Knex, in case the client wants to perform
   * arbitrary queries.
   */
  getKnex: function() {
    return localKnex;
  },

  /**
   * Temp Model method will be overridden when knex is connected. If the client
   * tries to call 'new Model()' before connection, we should throw an error.
   */
  Model: function() {
    throw new Error('Need to run modeller.connect() before creating a model');
  }
}

module.exports = modeller;
