/**
 * Test an instance of a Model class.
 */
var expect = require('chai').should(),
  env = require('./env');

describe('a Model instance', function() {
  before(env.setup);
  after(env.teardown);

  it('is an object constructor function', function() {
    var TestModel = env.getTestModelClass();

    TestModel.should.be.a('function');

    var instance = new TestModel();

    instance.should.be.an('object');
  });
});

describe('an instantiated Model object', function() {
  var TestModel = env.getTestModelClass(),
    instance;

  before(env.setup);
  after(env.teardown);

  beforeEach(function() {
    instance = new TestModel();
  });

  describe('.insert()', function() {
    it('is a method', function() {
      instance.insert.should.be.a('function');
    });

    it('returns a promise', function() {
      var promise = instance.insert();

      promise.then.should.be.a('function');
      promise.catch.should.be.a('function');
    });
  });

  describe('.update()', function() {
    it('is a method', function() {
      instance.update.should.be.a('function');
    });

    it('returns a promise', function() {
      var promise = instance.update();

      promise.then.should.be.a('function');
      promise.catch.should.be.a('function');
    });
  });

  describe('.delete()', function() {
    var NewModel, newInstance;

    before(function() {
      NewModel = env.getTestModelClass({
        id: {
          type: 'positive',
          primaryId: true
        }
      });

      newInstance = new NewModel({ id: 1 });
    });

    it('is a method', function() {
      instance.delete.should.be.a('function');
    });

    it('requires a primaryId to be defined on the model', function() {
      instance.delete.should.throw();
      newInstance.delete.should.not.throw();
    });

    it('returns a promise', function() {
      var promise = newInstance.delete();

      promise.then.should.be.a('function');
      promise.catch.should.be.a('function');
    });
  });
});
