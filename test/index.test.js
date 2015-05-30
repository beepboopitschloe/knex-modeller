/**
 * Test the exported library object.
 */

var expect = require('chai').expect,
  mockery = require('mockery');

describe('the library object', function() {
  before(function() {
    mockery.enable();

    // ignore the model module
    mockery.registerMock('./lib/model.js', function() { });

    mockery.registerAllowable('../index.js');

    // we will be mocking out knex differently for different tests, don't need
    // to be warned about it
    mockery.warnOnReplace(false);
  });

  it('initializes with a connect() function', function() {
    var lib = require('../index.js');

    expect(typeof lib.connect).to.equal('function');
  });

  it('requires a database configuration to connect', function() {
    var lib = require('../index.js'),
      caughtError;

    try {
      lib.connect();
      lib.connect({
        dialect: 'mysql',
        user: 'user',
        password: 'password',
        database: 'database'
      });
    } catch (e) {
      caughtError = e;
    } finally {
      expect(caughtError instanceof Error).to.equal(true);
    }
  });

  it('connects to localhost by default', function() {
    var lib = require('../index.js'),
      host = null;

    mockery.registerMock('knex', function(config) {
      host = config.connection.host;
    });

    lib.connect({
      dialect: 'mysql',
      user: 'user',
      password: 'password',
      database: 'database'
    });

    expect(host).to.equal('127.0.0.1');

    mockery.deregisterMock('knex');
  });

  it('connects to to port 3306 by default', function() {
    var lib = require('../index.js'),
      port = null;

    mockery.registerMock('knex', function(config) {
      port = config.connection.port;
    });

    lib.connect({
      dialect: 'mysql',
      user: 'user',
      password: 'password',
      database: 'database'
    });

    expect(port).to.equal(3306);

    mockery.deregisterMock('knex');
  });

  it('connects with the \'knex\' package by default', function() {
    var lib = require('../index.js'),
      loadedKnex = false;

    mockery.registerMock('knex', function() {
      loadedKnex = true;
    });

    lib.connect({
      dialect: 'mysql',
      user: 'user',
      password: 'password',
      database: 'database'
    });

    expect(loadedKnex).to.equal(true);
  });

  it('takes in an optional pre-configured knex object', function() {
    var lib = require('../index.js'),
      customKnex = 'custom';

    mockery.registerMock('./lib/model.js', function(knex) {
      expect(knex).to.equal(customKnex);

      done();
    });

    lib.connect({
      dialect: 'mysql',
      user: 'user',
      password: 'password',
      database: 'database',

      knex: customKnex
    });

    mockery.deregisterMock('./lib/model.js');
  });

  it('will not export Model() before connecting', function() {
    var lib = require('../index.js'),
      caughtError;

    try {
      lib.Model();
    } catch (err) {
      caughtError = err;
    } finally {
      expect(caughtError instanceof Error).to.equal(true);
    }
  });

  after(function() {
    mockery.warnOnReplace(true);
    mockery.deregisterAll();
    mockery.disable();
  });
});
