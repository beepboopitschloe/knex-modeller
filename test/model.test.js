/**
 * Test the Model class generator.
 */

var expect = require('chai').should(),
  mockery = require('mockery'),
  knex = require('knex'),
  mockKnex = require('mock-knex');

var db = knex({
  client: 'mysql'
});

/**
 * Require lib/model.js with mockKnex
 *
 * in a function to save typing
 */
function getGen() {
  return require('../lib/model.js')(mockKnex);
}

function setup() {
  mockKnex.setAdapter('knex@0.8');
  mockKnex.mock(db);

  mockery.enable();

  mockery.registerMock('knex', mockKnex);
  mockery.registerAllowables([
    '../lib/model.js',
    'check-types',
    'lodash',
    'q'
  ]);
}

function teardown() {
  mockKnex.unmock(db);

  mockery.deregisterAll();
  mockery.disable();
}

describe('the Model generator', function() {
  before(setup);
  after(teardown);

  it('is a function', function() {
    // require but don't call
    var generator = require('../lib/model.js');

    generator.should.be.a('function');
  });

  it('returns a Model constructor', function() {
    // require and call
    var Model = getGen();

    Model.should.be.a('function');

    var model = new Model('table', {});
  });
});

describe('the Model constructor', function() {
  before(setup);
  after(teardown);

  it('throws an error without a table name and configuration object', function() {
    var Model = getGen();

    // call with no args
    Model.bind(null).should.throw(TypeError);

    // call with one arg of incorrect type
    Model.bind(null, 123).should.throw(TypeError);

    // call with one arg of incorrect length
    Model.bind(null, '').should.throw(TypeError);

    // call with no second arg
    Model.bind(null, 'table').should.throw(TypeError);

    // call with second arg of incorrect type
    Model.bind(null, 'table', 123).should.throw(TypeError);

    // call with correct types
    Model.bind(null, 'table', {}).should.not.throw();
  });

  it('returns an Instance constructor', function() {
    var Model = getGen();

    var Instance = new Model('table', {});

    Instance.should.be.a('function');
  });
});

describe('an Instance constructor', function() {
  before(setup);
  after(teardown);

  it('requires no arguments', function() {
    var Model = getGen(),
      Instance = new Model('test', {});

    Instance.bind(null, {}).should.not.throw();
  });

  it('returns an Instance object', function() {
    var Model = getGen(),
      Instance = new Model('test', {});

    new Instance().should.be.an('object');
  });
});

describe('an Instance object', function() {
  before(setup);
  after(teardown);

  it('is an object', function() {
    var Model = getGen(),
      Instance = new Model('test', {});

    var instance = new Instance();
  });
});
