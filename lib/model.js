/**
 * model.js
 *
 * A simple object modeller.
 */

var check = require('check-types'),
  _ = require('lodash'),
  q = require('q');

/**
 * Validate that the 'values' object is consistent with the property definitions
 * in 'properties'. Throw an error if anything is out of sync.
 */
function checkTypes(definitions, values) {
  _.each(definitions, function(def, key) {
    var value = values[key];

    if (_.isUndefined(value) || _.isNull(value)) {
      if (!_.isUndefined(def.default) && !_.isNull(def.default)) {
        // if there is a default value, use that
        if (check.function(def.default)) {
          value = def.default();
        } else {
          value = def.default;
        }
      } else if (def.nullable || def.autoIncrement) {
        // if we haven't found any values yet, and this property is nullable
        // or automatically assigned, return and move on to the next value
        return;
      } else {
        // otherwise throw an error
        throw new Error('Missing required property ' + key);
      }
    }

    // assert that the types match
    try {
      check.assert[def.type](value);
    } catch (e) {
      throw new TypeError('Field ' + key + ' requires type ' + def.type +
          ' but has type ' + typeof value);
    }

    if (check.function(def.validate)) {
      // if there is a validation function in the definitions, assert that the
      // value passes that as well
      var valid = def.validate(value);

      if (valid === true) {
        // everything is fine
      } else if (valid === false) {
        // did not pass validation function
        throw new TypeError('Value ' + value + ' did not pass custom ' +
            'validation function on field ' + key);
      } else {
        throw new TypeError('validate() function for ' + key + ' must return ' +
            'a boolean.');
      }
    }
  });
}

/**
 * Apply all values in the 'values' object to the given object.
 */
function applyValues(obj, values) {
  _.each(values, function(val, key) {
    obj[key] = val;
  });
}

/**
 * Function to create the Model class using an arbitrary instance of Knex.
 */
function createModelClass(knex) {
  /**
   * Model constructor. Takes a list of definitions and their expected types.
   * All fields are mandatory unless marked nullable.
   *
   * ex.
   * Model('Movie', {
   *   movieId: {
   *     type: 'positive',
   *     autoIncrement: true,
   *     primaryId: true
   *   },
   *   productionCompanyId: {
   *     type: 'positive'
   *   }
   *   year: {
   *     type: 'number'
   *   },
   *   title: {
   *     type: 'string',
   *     default: 'Untitled'
   *   },
   *   metadata: {
   *     type: 'string',
   *     nullable: true,
   *     default: getMetadata // function to get metadata
   *   }
   * });
   */
  function Model(table, definitions) {
    if (!check.string(table) || !check.object(definitions)) {
      throw new TypeError('Model() must be called with a string table name ' +
          'and an object schema definition');
    }

    /**
     * The Model constructor to return.
     */
    var m = function(values) {
      // strip out any values with keys that are not defined in the definitions
      // object
      values = _.pick(values, function(val, key) {
        return definitions.hasOwnProperty(key);
      });

      // apply transform for any definitions that have a transform() function
      _.each(values, function(val, key) {
        if (check.function(definitions[key].transform)) {
          values[key] = definitions[key].transform(val);
        }
      });

      // throw an error if any provided values have bad types
      checkTypes(definitions, values);

      // apply the values to this object
      applyValues(this, values);
    };

    /**
     * Use special definition _statics for user-defined static methods. Make
     * sure to remove it from the definitions object so that it does not get
     * caught in type checking.
     */
    if (definitions._statics) {
      m.statics = definitions._statics;
      delete definitions._statics;
    } else {
      m.statics = {};
    }

    /**
     * definitions._overrides contains user-defined overrides for the methods
     * get(), getOne(), insert(), update(), and delete().
     *
     * Here we perform validation and error out if the override values are not
     * functions or the user has tried to override the immutable methods
     * isValid(), getKnex(), and raw().
     */
    var overrides = {};

    if (_.isObject(definitions._overrides)) {
      // the user has provided method overrides

      // List of methods which may be overridden
      var mutableMethods = ['get', 'getOne', 'insert', 'update'];

      // validate each override in definition._overrides
      _.each(definitions._overrides, function(prop, key) {
        if (_.contains(mutableMethods, key)) {
          // the user has tried to override a mutable method, which is OK
          if (_.isFunction(prop)) {
            // and the provided override is a function, so everything is good.
            // copy the prop into the overrides object
            overrides[key] = prop;
          } else {
            // the user provided a value which is not a function, throw an error
            throw new TypeError('Model _overrides object should only contain ' +
                'functions');
          }
        } else {
          // if the user has tried to override an immutable method, throw an error
          throw new Error('Cannot override immutable method ' + key +
              ' on model ' + table);
        }
      });

      // now that validation is done, delete the original object so that it will
      // not be used in any methods that operate on definitions
      delete definitions._overrides;
    }

    /**
     * Set static properties on the model.
     *
     * m._primaryKey holds the name of the primary key for this model.
     *
     * m._hasDeletedBit is true if the model has a property called 'deleted'
     *   which we use to tell if a record should be omitted from get/getOne
     *   operations.
     */
    _.each(definitions, function(def, key) {
      if (def.primaryId === true && !m._primaryKey) {
        m._primaryKey = key;
      } else if (def.primaryId === true && m._primaryKey) {
        throw new Error('Cannot have multiple primary keys on model ' + table);
      }

      if (key === 'deleted') {
        m._hasDeletedBit = true;
      }
    });

    /**
     * Static validation method. Returns true if the provided object can create
     * a valid instance of the model.
     */
    m.isValid = function(obj) {
      if (!obj) {
        return false;
      }

      try {
        checkTypes(definitions, obj);

        return true;
      } catch(e) {
        console.error(e.message);

        return false;
      }
    };

    /**
     * Static method to get this model's instance of knex.
     */
    m.getKnex = function() {
      return knex;
    };

    /**
     * Static raw method. Runs a raw SQL query through knex and returns the
     * result.
     */
    m.raw = function(query, bindings) {
      query = query || {};
      bindings = bindings || [];

      var deferred = q.defer();

      knex.raw(query, bindings).then(function(data) {
        // `data` is an array containing two arrays, the first of which
        // contains the rows. this is an atrocious structure. let's protect
        // our client from it
        return deferred.resolve(data[0]);
      })
      .catch(function(err) {
        return deferred.reject(err);
      });

      return deferred.promise;
    };

    /**
     * Static method to tell if the model contains a certain field.
     */
    m.hasField = function(key) {
      return _.has(definitions, key);
    };

    /**
     * Static get method. Gets rows based on an input query.
     */
    if (overrides.get) {
      // if the user has provided an override
      m.get = overrides.get;
    } else {
      // use the default method
      m.get = function(query, options) {
        if ((query && !check.object(query)) ||
            (options && !check.object(options))) {
          // both arguments must be an objects if they are provided
          throw new TypeError('Arguments to get() must be of type object');
        }

        query = query || {};

        // options for pagination
        options = options || {};

        var defaults = {
          // the max number of records to return
          // @TODO this should be a config option
          limit: 100,

          // the index from which we should start returning records
          offset: 0
        };

        if (m._primaryKey) {
          // if the model has a primary key, then that will be the default field
          // to order the results by
          defaults.orderBy = m._primaryKey;

          // true for ascending order, false for descending order
          defaults.asc = true;
        }

        options = _.defaults(options, defaults);

        if (m._hasDeletedBit && query.deleted === undefined) {
          query.deleted = 0;
        }

        var statement = knex(table)
        .where(query)
        .limit(options.limit)
        .offset(options.offset);

        if (options.orderBy) {
          statement.orderBy(options.orderBy, options.asc? 'asc' : 'desc');
        }

        return statement.select()
        .then(function(rows) {
          return rows.map(function(row) {
            return new m(row);
          });
        });
      };
    }

    /**
     * Static getOne method. Same as above, but returns an instance of the model
     * instead of an array of values.
     */
    if (overrides.getOne) {
      // the user has provided a custom getOne method
      m.getOne = overrides.getOne;
    } else {
      // use the default getOne method
      m.getOne = function(query) {
        if (query && !check.object(query)) {
          // only accept an object as a query
          throw new TypeError('Argument to getOne() must be of type object');
        }

        query = query || {};

        if (m._hasDeletedBit && _.isUndefined(query.deleted)) {
          // default to only getting non-deleted objects
          query.deleted = 0;
        }

        return knex(table).where(query).select().then(function(rows) {
          if (rows.length) {
            return new m(rows[0]);
          } else {
            return null;
          }
        });
      };
    }

    /**
     * Static deleteWhere method. Deletes objects which satisfy a given query.
     * If this model has a 'deleted' bit, this will flip that bit to 1, which
     * will prevent them from being returned by get() or getOne().
     * Otherwise it will just delete them.
     */
    if (overrides.deleteWhere) {
      // the user has provided a custom deleteWhere method
      m.deleteWhere = overrides.deleteWhere;
    } else {
      // use the default deleteWhere method
      m.deleteWhere = function(query) {
        if (!check.object(query)) {
          throw new TypeError('deleteWhere() requires an argument of type ' +
              'object');
        }

        query = query || {};

        if (m._hasDeletedBit) {
          // don't delete deleted things
          query.deleted = 0;

          // set deleted to 1 on records that satisfy the query
          return knex(table).where(query).update({
            deleted: 1
          });
        } else {
          // delete records that satisfy the query
          return knex(table).where(query).delete().then();
        }
      };
    }

    /**
     * Generic insert method. Inserts the current instance into the table.
     */
    if (overrides.insert) {
      // the user has provided a custom insert method
      m.prototype.insert = overrides.insert;
    } else {
      m.prototype.insert = function() {
        var self = this;

        // delete auto-increment keys before performing insert
        _.each(definitions, function(def, key) {
          if (def.autoIncrement) {
            delete self[key];
          }
        });

        if (m._primaryKey) {
          // if a primary key was provided, return the inserted object instead
          // of the insertId.
          return knex(table).insert(self)
          .then(function(result) {
            var insertId = result[0],
              query = {};

            query[m._primaryKey] = insertId;

            return m.getOne(query);
          });
        } else {
          // otherwise, just return the insertId.
          return knex(table).insert(self);
        }
      };
    }

    /**
     * Generic update method. Takes in new properties, applies them to the
     * instance, and updates it in the table.
     */
    if (overrides.update) {
      // the user has provided a custom update function
      m.prototype.update = overrides.update;
    } else {
      // use the default update function
      m.prototype.update = function(updateWith) {
        var self = this;

        updateWith = _.extend(_.clone(this), updateWith);

        // first check types on the new values
        checkTypes(definitions, updateWith);

        // need to do some funky magic to get the right key/value pair for this
        // instance's primary id
        var whereClause = {};
        whereClause[m._primaryKey] = this[m._primaryKey];

        // strip out anything in the provided values that is not a defined part of
        // the model
        updateWith = _.pick(updateWith, function(val, key) {
          return definitions.hasOwnProperty(key);
        });

        return knex(table).where(whereClause).update(updateWith)
        .then(function() {
          // if the query succeeds, return a new object with the new values
          var updated = new m(updateWith);

          applyValues(self, updated);

          return updated;
        });
      };
    }

    /**
     * Generic delete method. If there is a `deleted` flag in the model, it flips
     * that flag to 1; otherwise, it deletes the record.
     */
    if (overrides['delete']) {
      // the user has provided a custom delete function
      m.prototype.delete = overrides['delete'];
    } else if (m._hasDeletedBit) {
      // use the default `deleted` bit function
      m.prototype.delete = function() {
        var whereClause = {};

        if (m._primaryKey) {
          whereClause[m._primaryKey] = this[m._primaryKey];
        } else {
          throw new Error('Cannot delete', table, 'without primary key definition');
        }

        return knex(table).where(whereClause).update({
          deleted: 1
        });
      };
    } else {
      // the default SQL DELETE function
      m.prototype.delete = function() {
        var whereClause = {};

        if (m._primaryKey) {
          whereClause[m._primaryKey] = this[m._primaryKey];
        } else {
          throw new Error('Cannot delete', table, 'without primary key definition');
        }

        return knex(table).where(whereClause).del();
      };
    }

    return m;
  }

  return Model;
} // end createModelClass

module.exports = createModelClass;
