/**
 * Exports values needed for the test environment.
 */

var knex = require('knex'),
  mockKnex = require('mock-knex');

var env = {};

env.db = knex({
  client: 'mysql'
});

env.tracker = mockKnex.getTracker();

/**
 * Requires lib/model.js with the mockKnex db instance
 */
env.getGenerator = function() {
  return require('../lib/model.js')(env.db);
};

/**
 * Get a TestModel class.
 */
env.getTestModelClass = function(defs) {
  var Model = env.getGenerator();

  return new Model('TestModel', defs || {});
};

/**
 * Set up before a test.
 */
env.setup = function() {
  mockKnex.setAdapter('knex@0.8');
  mockKnex.mock(env.db);

  env.tracker.install();
};

/**
 * Teardown after a test.
 */
env.teardown = function() {
  mockKnex.unmock(env.db);
  env.tracker.uninstall();
};

module.exports = env;
