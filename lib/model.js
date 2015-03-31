/**
 * model.js
 *
 * A simple object modeller.
 */

var check = require('check-types'),
  _ = require('lodash');

/**
 * Validate that the 'values' object is consistent with the property definitions
 * in 'properties'. Throw an error if anything is out of sync.
 */
function checkTypes(definitions, values) {
  _.each(definitions, function(def, key) {
    var value = values[key];

    if (!value) {
      if (def.default) {
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
    check.assert[def.type](value);
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
    /**
     * The Model constructor to return.
     */
    var m = function(values) {
      // this will throw an error if any provided values have bad types
      checkTypes(definitions, values);

      // apply the values to this object
      applyValues(this, values);
    };

    /**
     * Set the primary ID field as a static property on the model.
     */
    _.each(definitions, function(def, key) {
      if (def.primaryId === true && !m._primaryKey) {
        m._primaryKey = key;
      } else if (def.primaryId === true && m._primaryKey) {
        throw new Error('Cannot have multiple primary keys on model ' + table);
      }
    });

    /**
     * Static validation method. Returns true if the provided object can create
     * a valid instance of the model.
     */
    m.isValid = function(obj) {
      try {
        checkTypes(definitions, obj);

        return true;
      } catch(e) {
        return false;
      }
    }

    /**
     * Static get method. Gets rows based on an input query.
     */
    m.get = function(query) {
      return knex(table).where(query || {}).select();
    }

    /**
     * Static getOne method. Same as above, but returns an instance of the model
     * instead of an array of values.
     */
    m.getOne = function(query) {
      return knex(table).where(query || {}).select().then(function(rows) {
        if (rows.length) {
          return new m(rows[0]);
        } else {
          return null;
        }
      });
    }

    /**
     * Generic insert method. Inserts the current instance into the table.
     */
    m.prototype.insert = function() {
      var self = this;

      // delete auto-increment keys before performing insert
      _.each(definitions, function(def, key) {
        if (def.autoIncrement) {
          delete self[key];
        }
      });

      return knex(table).insert(self);
    }

    /**
     * Generic update method. Takes in new properties, applies them to the
     * instance, and updates it in the table.
     */
    m.prototype.update = function(newValues) {
      newValues = _.extend(_.clone(this), newValues);

      checkTypes(definitions, newValues);
      applyValues(this, newValues);

      // need to do some funky magic to get the right key/value pair for this
      // instance's primary id
      var whereClause = {};
      whereClause[m._primaryKey] = this[m._primaryKey];

      return knex(table).where(whereClause).update(this);
    }

    return m;
  }

  return Model;
} // end createModelClass

module.exports = createModelClass;
