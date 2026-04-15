/**
 * Tiny internal toolkit to work with types at runtime when dealing
 * with Enumerations.
 *
 * @type {TypeToolbox}
 */
export const is = {
  object(v) { return !!(v && typeof (v) === 'object') },
  function(v) { return (typeof(v) === 'function') || v instanceof Function },
  array(v) { return Array.isArray(v) },
  number(v) { return (typeof(v) === 'number' || v instanceof Number)},
  objectEntry(v) {
    return this.array(v) && v.length === 2 && this.objectKey(v[0])
  },
  objectKey(v) {
    const types = ['symbol', 'string', 'number']

    return types.some(type => typeof v === type)
  },
}

/**
 * Allows the creation of static, complex, enumeration values
 * that can be used and identified at runtime (as opposed to
 * TypeScript enum values which apply only during compile time).
 *
 * Below is a simple example defining some colors on a `Color`
 * enum. Simple enums are a combination of key and value. In
 * the following case the key is the color name and the value
 * is an object with color channel data (red, green, blue, and
 * alpha channel values from 0 to 255).
 *
 * ```js
 * class Color extends Enumeration {
 *   static {
 *     Color.define('red', {r: 255, g: 0, b: 0, a: 255})
 *     Color.define('green', {r: 0, g:255, b: 0, a: 255})
 *     Color.define('blue', {r: 0, g: 0, b: 255, a: 255})
 *   }
 * }
 *
 * Color.red.value.r === 255 // true
 * Color.red.r === 255 // true; this uses the SubscriptProxy
 *
 * // Grab all four color channels' data in one go. This also
 * // uses the SubscriptProxy for syntactic sugar.
 * const { r, g, b, a } = Color.red
 * ```
 *
 * New types could be defined later with subsequent Color.define()
 * calls. But take the case of customizable color case such as
 * one that is different everytime it is used. Each instance of a
 * child class of an Enumeration has the option to associate values
 * to it.
 *
 * ```js
 * class Color extends Enumeration {
 *   static {
 *     // assume cases from above as well
 *
 *     // define an `rgb` case that assumes associated color
 *     // channel data.
 *     Color.define('rgb', {r: 0, g: 0, b: 0, a: 255})
 *   }
 * }
 *
 * let car = { model: "Ferrari", color: Color.red }
 * let horse = {
 *   breed: "American Saddlebred",
 *   color: Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
 * }
 * ```
 *
 * This last snippet of code creates a contrived horse object with
 * a chestnut/sorrel colored color. The enum case type for this is
 * still `Color.rgb`, but a rgb cased enum indicates at least three
 * color channels. It's specific values are available through
 * the SubscriptProxy's direct key value access, .r/.g/.b/.a, but
 * is stored not in the value but in the associations object. If we
 * wanted `Color.rgb` to directly surface its associated values, a
 * little more customization would be needed.
 *
 * ```js
 * class Color extends Enumeration {
 *   static {
 *     // assume cases from above as well
 *
 *     // define an `rgb` case that assumes associated color
 *     // channel data.
 *     Color.define('rgb', {r: 0, g: 0, b: 0, a: 255}, {
 *       // always return the associations object instead of the
 *       // value for an unmodified Color enum case.
 *       get value() { return this.associations }
 *     })
 *   }
 * }
 *
 * // Now, you can access it in all three ways.
 * const { r, g, b, a } = horse.color
 * // or
 * const { r, g, b, a } = horse.color.value
 * // or
 * const { r, g, b, a } = horse.color.associations
 * ```
 *
 * When programmers think of enums, they inevitably think of
 * the switch/case construct. This works with Enumeration instances
 * as well. That might look like this.
 *
 * ```js
 * switch (horse.color.key) {
 *   case Color.red.key: ...; break;
 *   case Color.green.key: ...; break;
 *   case Color.blue.key: ...; break;
 * }
 * ```
 *
 * But this is largely because enums in many languages, outside of Swift,
 * are often simple constant keys with values of either the same as their
 * name or incrementing numbers. With Enumeration, each case is a fully
 * fledged instance of the Enumeration type. So we could easily provide
 * methods that work on the aforementioned color channel value object.
 *
 * ```js
 * class Color extends Enumeration {
 *   toHex(includeAlpha = false) {
 *     const { r, g, b, a } = this;
 *     const base = `#` + [r, g, b]
 *       .map(c => c.toString(16).padStart(2, '0')).join('');
 *
 *     if (includeAlpha)
 *       return (base + a.toString(16));
 *
 *     return base;
 *   }
 *
 *   static {
 *     // define cases
 *   }
 * }
 * ```
 *
 * Now there is little need for the switch case. You can simply use it define
 * a hexadecimal color. The case becomes the controller, the value/associations
 * become the model. The case knows how to operate on all types of this class,
 * or in this case all colors. The value or associations object are the model
 * and the methods such as toHex() belong to the controller.
 *
 * Given that we are using normal JavaScript to achieve this, everything is
 * where you would expect it to be; `toHex()` lives on the `Color.prototype`
 * object and all normal JavaScript manipulation works here.
 *
 * ```js
 * console.log(car.color.toHex())  // #ff0000
 * console.log(horse.color.toHex())  // #c84c31
 * ```
 *
 * For more complex use cases you could use the Color.match() function
 *
 * ```js
 * Color.match(horse.color, (color, enumCase, { r, g, b, a }) => {
 *   // horse.color is Color.rgb with associated values
 *   // enumCase is Color.rgb without associated values
 *   // the third parameter is either an empty object or the custom
 *   //   associations object that you can destructure expected content
 *   //   from.
 *
 *   // do something with r, g, b, a if `horse.color` is a Color case type
 * })
 * ```
 */
export class Enumeration {
  /**
   * The case name for this {@link Enumeration} instance.
   *
   * @type {string|symbol}
   */
  key;

  /**
   * The value for this case name, defaults to the same as the
   * case name unless specifically supplied.
   *
   * @type {any}
   */
  value;

  /**
   * For {@link Enumeration} instances that have instance level associated
   * values. This is uncommon but is modeled after Swift's enums with
   * associated values. This object is `null` if there are no associations.
   *
   * @type {object}
   */
  associations;

  /**
   * Creates a new simple {@link Enumeration} case with a key (case name)
   * and associated value of any type. If no value is supplied, it will be
   * set to the value of the key unless `acceptUndefinedValue` is set to
   * true.
   *
   * @param {string|number|symbol} key the case name represented by this
   * instance of {@link Enumeration}.
   * @param {any} value any value for this enumeration case. If this is
   * `undefined` and `acceptUndefinedValue` is set to false (the default)
   * then the value will be identical to the `key`.
   * @param {boolean} [acceptUndefinedValue=false] a flag that allows the
   * rare case of setting a case's value explicitly to `undefined`
   * @returns {Enumeration} a new {@link Enumeration} value, or instance of
   * whatever child class has extended `Enumeration`.
   */
  constructor(key, value = undefined, acceptUndefinedValue = false) {
    if (value === undefined && !acceptUndefinedValue) value = key;

    Object.assign(this, { key, value });
    Object.defineProperty(this, 'associations', {
      value: null,
      configurable: true,
      enumerable: false,
      writable: true,
    });

    /**
     * Enables a subscript proxy on the instances of each {@link Enumeration}
     * derived instance such that if there is no actual relevant property of
     * the same name, and the instance has associated values, then it returns
     * the value of the property of the same name on the associations object
     * within.
     *
     * @example
     * class Shapes extends Enumeration {
     *   static {
     *     Shapes.define('other')
     *   }
     * }
     *
     * let customShape = Shapes.other.associate({name: 'Dodecahedron'})
     *
     * console.log(customShape.name) // "Dodecahedron"
     *
     * @note if there is an existing property of the same name, such as the
     * `.key` or `.value`, it is safer to use the {@link Enumeration#associated}
     * function retrieve the value. You have been warned.
     */
    Object.setPrototypeOf(
      this.constructor.prototype,
      SubscriptProxy(
        Object.create(Object.getPrototypeOf(this.constructor.prototype))
      )
    );

    return this;
  }

  /**
   * Creates a duplicate of this enumeration case, and assigns instance
   * level associated key/value pairs on the copy. It is still of the
   * same enum class type, but has instance level associated value.
   *
   * @param {...(object|string|number|symbol|[string|number|symbol,any])} entries
   * a variadic list of objects (whose key/value pairs will be flattened
   * and added to the associations), a key (string|number|symbol) whose
   * value will be the same as the key, or an Object entry (i.e. an array with
   * the first value being the key and the second value being the value).
   * @returns {*} an instance of this class
   */
  associate(...entries) {
    const associations = { };

    for (const entry of entries) {
      if (is.objectEntry(entry)) {
        associations[entry[0]] = entry[1];
      }
      else if (is.object(entry)) {
        Object.assign(associations, entry);
      }
      else if (is.objectKey(entry)) {
        associations[entry] = entry;
      }
    }

    if (this.hasAssociatedValues) {
      Object.assign(this.associations, associations);

      return this;
    }

    // Create a duplicate of this case instance
    const variantCase = Object.create(this);

    // Assign the associations object we created
    variantCase.associations = associations;

    return variantCase;
  }

  /**
   * Shorthand for retrieving an internal associated value
   *
   * @param {string|number|symbol} key a key into the internal
   * associations store. Typically, this value is null.
   * @returns {any|null} null if there is no such named association
   * or if there are no associations stored on this enum value.
   */
  associated(key) {
    return this.associations?.[key];
  }

  /**
   * Returns true if there is an associated value for this enumeration case.
   *
   * @returns {boolean} true if associations exist, denoting this is as
   * a variant case; false otherwise.
   */
  get hasAssociatedValues() {
    return this.associations !== null;
  }

  /**
   * Checks to see if this object is, or is loosely, the same as
   * the supplied `someCase` value. This is determined by comparing
   * the `.key` property.
   *
   * @param {any} someCase some object value that might have a
   * matching (double equals) key property value
   * @returns {boolean} true if the objects are loosely equal (==)
   * or if each of `.key` values are loosely equal (==)
   */
  is(someCase) {
    // noinspection EqualityComparisonWithCoercionJS
    return this == someCase || this?.key == someCase?.key;
  }

  /**
   * Define the string representation of any given {@link Enumeration}
   * instance to be its `.key` value.
   *
   * @returns {string} the value of the `.key` property wrapped in
   * a call to `String()` to ensure conversion.
   */
  toString() {
    return String(this.key);
  }

  /**
   * Returns a combination of the class' name followed by this
   * instances key value. This can be more explicit than just using
   * the `.key` property.
   *
   * @example
   * class Shape extends Enumeration {
   *   static {
   *     Shape.define('circle')
   *     Shape.define('square')
   *   }
   * }
   *
   * console.log(Shape.circle.case) // 'Shape.circle'
   *
   * // ['Shape.circle', 'Shape.square']
   * console.log([...Shape.values()].map(s => s.case))
   *
   * @type {string}
   */
  get case() {
    return `${this.constructor.name}.${String(this.key)}`
  }

  /**
   * Define the result of a call to {@link #valueOf} to always be
   * the contents of the `.value` property.
   *
   * @returns {any} the contents of the `.value` property
   */
  valueOf() {
    return this.value
  }

  /**
   * Returns the `.key` value as a primitive, unless a conversion to
   * number is requested. In which case, if the `.value` property is
   * of type {@link Number} then it will be returned. In all other
   * cases the result will be `String(this.key)`.
   *
   * @returns {string|number|NaN} returns a {@link String} representation
   * of the `.key` property unless a number is requested. See above
   * for custom logic pertaining to number coercion.
   */
  [Symbol.toPrimitive](hint) {
    switch (hint) {
      default:
      case 'string':
        return String(this.key);

      case 'number':
        return is.number(this.value)
          ? this.value
          : Number(this.key)
    }
  }

  /**
   * Generates a custom tag name that matches this instances class name.
   *
   * @example
   * class Shape extends Enumeration {
   *   static { Shape.define('circle') }
   * }
   *
   * console.log(Shape.circle[Symbol.toStringTag]) // 'Shape'
   */
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }

  /**
   * Given an instance of a child class of {@link Enumeration}, this code
   * walks through all valid enum cases for this class. If either present
   * or missing are functions, they will be invoked and their results will
   * be what are returned from this match. If they are not functions, then
   * their direct values will be returned. If they are not supplied, true
   * is returned if the case is present, false is returned otherwise.
   *
   * In the case of present being a function, its signature is expected
   * to be something like the following. Note that this will be awaited
   * before returning its result.
   *
   * ```js
   * async present(instance, baseCase, associations) => Promise<any>
   * ```
   * where
   *  * **instance** is the instance of the enum supplied
   *  * **baseCase** is the instance of the enum matching `instance`
   *  * **associations** is either an empty object when there are no custom
   *    associations, or the associations object itself.
   *
   * and missing simply receives the instance passed to `asyncMatch()`,
   * but if missing is an async function, its call will be awaited before
   * returning a result.
   *
   * ```js
   * async missing(instance) => Promise<any>
   * ```
   * where
   *  * **instance** is the instance of the enum supplied
   *
   * Some examples:
   * ```js
   * Color.match(Color.red) // returns true
   * Color.match(Color.red, (_,__,{r}) => r) // returns 255
   * Color.match(null) // returns false
   * Color.match(null, (_,__,{r}) => r, () => 0) // returns 0
   * Color.match(null, 'red', 'missing') // returns 'missing'
   *
   * Color.match(horse.color) // returns true
   * Color.match(horse.color, instance => instance.toHex()) // '#c84c31'
   * ```
   *
   * @param {Enumeration} instance an instance of any {@link Enumeration}
   * derived class. With or without associated values.
   * @param {
   *   (function(Enumeration,Enumeration,object): Promise<any>|any|undefined)
   * } present an async function that computes a value or a variable value to
   * return if the `instance` is one of the known {@link Enumeration} cases
   * for this subclass. Defaults to `true` if not supplied
   * @param {function(Enumeration): Promise<any>} missing an async function
   * that computes a value or a variable value to return if the `instance` is
   * not one of the known cases for this subclass. Defaults to `false` if not
   * supplied.
   * @returns {any} the result of either `present`, or `missing`, using the
   * default values of `true` and `false`, respectively, should they not be
   * supplied. The outcome is determined by the existence of the supplied
   * `instance` object being a known case for this enum subclass.
   */
  static async asyncMatch(instance, present, missing) {
    const resolvePresent = async (caseValue) => {
      if (is.function(present)) {
        const associations = instance?.associations
          ?? (is.object(instance?.value) ? instance.value : {});
        return present(instance, caseValue, associations);
      }

      else
        return present ?? true;
    }

    const resolveMissing = async () => {
      if (is.function(missing))
        return await missing(instance);
      else
        return missing ?? false;
    }

    if (!is.object(instance) || !(instance instanceof this))
      return await resolveMissing();

    for (const [_, caseValue] of this) {
      if (instance.key === caseValue.key)
        return await resolvePresent(caseValue);
    }

    return await resolveMissing();
  }

  /**
   * Static variant of {@link Enumeration#is} that takes a left and
   * right hand value, then checks to see if both objects are, or are
   * loosely, the same as each other's `.key` value.
   *
   * @param {any} leftCase some object value that might have a
   * matching (double equals) key property value
   * @param {any} rightCase some object value that might have a
   * matching (double equals) key property value
   * @returns {boolean} true if the objects are loosely equal (==)
   * or if each of `.key` values are loosely equal (==)
   */
  static is(leftCase, rightCase) {
    // noinspection EqualityComparisonWithCoercionJS
    return leftCase == rightCase || leftCase?.key == rightCase?.key;
  }

  /**
   * Used when creating a static instance of {@link Enumeration}. Generally
   * this is done as follows:
   *
   * @example
   * class Shape extends Enumeration {
   *   static {
   *     Shape.define('cylinder')
   *     Shape.define('cube')
   *     Shade.define('other')
   *   }
   * }
   *
   * @param {string|number|symbol} key the case name of the this particular
   * enumeration instance.
   * @param {any|[string|number|symbol, any]} value the value of the newly
   * defined {@link Enumeration} instance.
   * @param {function|object} [customizeInstance=undefined] defaults to
   * `undefined`, but when it is passed in as a function, the signature
   * would be to take an instance of this Enumeration class and return
   * one (presumably after modification), or in the form of an object whose
   * property descriptors are copied onto the defined instance. This later
   * approach retains getter and setter application as well as other rare
   * descriptor modifications.
   * @returns {*} an instance of this {@link Enumeration} class type.
   */
  static define(key, value = undefined, customizeInstance = undefined) {
    if (!is.objectKey(key)) {
      throw new TypeError(
        'Enumeration.define() must have a string/number/symbol key'
      );
    }

    let caseName = key;
    let caseValue = value ?? key;

    if (is.objectEntry(value)) {
      caseName = value[0];
      caseValue = value[1];
    }

    let instance = new this(caseName, caseValue);

    if (customizeInstance instanceof Function) {
      const newInstance = customizeInstance(instance);

      if (newInstance instanceof this)
        instance = newInstance;
    }
    else if (is.object(customizeInstance)) {
      const descriptors = Object.getOwnPropertyDescriptors(customizeInstance)

      Object.defineProperties(instance, descriptors)
    }

    Object.defineProperty(this, key, {
      get() {
        return instance;
      },
      configurable: true,
      enumerable: true,
    });
  }

  /**
   * Creates an iterator of all {@link Enumeration} derived instances that
   * are statically assigned to this class. Generally this is only useful
   * if applied to child class of `Enumeration`.
   *
   * @returns {Generator<string, void, *>} an iterator that walks instances
   * of derived {@link Enumeration} classes and returns their `.key` values
   */
  static *cases() {
    for (let [key, _] of this) yield key;
  }

  /**
   * Given an instance of a child class of {@link Enumeration}, this code
   * walks through all valid enum cases for this class. If either present
   * or missing are functions, they will be invoked and their results will
   * be what are returned from this match. If they are not functions, then
   * their direct values will be returned. If they are not supplied, true
   * is returned if the case is present, false is returned otherwise.
   *
   * In the case of present being a function, its signature is expected
   * to be something like the following:
   *
   * ```js
   * present(instance, baseCase, associations) => any
   * ```
   * where
   *  * **instance** is the instance of the enum supplied
   *  * **baseCase** is the instance of the enum matching `instance`
   *  * **associations** is either an empty object when there are no custom
   *    associations, or the associations object itself.
   *
   * and missing simply receives the instance passed to `match()` as its
   * only parameter.
   *
   * ```js
   * missing(instance) => any
   * ```
   * where
   *  * **instance** is the instance of the enum supplied
   *
   * Some examples:
   * ```js
   * Color.match(Color.red) // returns true
   * Color.match(Color.red, (_,__,{r}) => r) // returns 255
   * Color.match(null) // returns false
   * Color.match(null, (_,__,{r}) => r, () => 0) // returns 0
   * Color.match(null, 'red', 'missing') // returns 'missing'
   *
   * Color.match(horse.color) // returns true
   * Color.match(horse.color, instance => instance.toHex()) // '#c84c31'
   * ```
   * @param {Enumeration} instance an instance of any {@link Enumeration}
   * derived class. With or without associated values.
   * @param {
   *   (function(Enumeration,Enumeration,object): any|any|undefined)
   * } present a function that computes a value or a variable value to
   * return if the `instance` is one of the known {@link Enumeration} cases
   * for this subclass. Defaults to `true` if not supplied
   * @param {function(Enumeration): any} missing a function
   * that computes a value or a variable value to return if the `instance` is
   * not one of the known cases for this subclass. Defaults to `false` if not
   * supplied.
   * @returns {any} the result of either `present`, or `missing`, using the
   * default values of `true` and `false`, respectively, should they not be
   * supplied. The outcome is determined by the existence of the supplied
   * `instance` object being a known case for this enum subclass.    */
  static match(instance, present, missing) {
    const resolvePresent = (caseValue) => {
      if (is.function(present)) {
        const associations = instance?.associations
          ?? (is.object(instance?.value) ? instance.value : {});
        return present(instance, caseValue, associations);
      }

      else
        return present ?? true;
    }

    const resolveMissing = () => {
      return is.function(missing) ? missing(instance) : (missing ?? false);
    }

    if (!is.object(instance) || !(instance instanceof this))
      return resolveMissing();

    for (const [_, caseValue] of this) {
      if (instance.key === caseValue.key)
        return resolvePresent(caseValue);
    }

    return resolveMissing();
  }

  /**
   * Creates an iterator of all {@link Enumeration} derived instances that
   * are statically assigned to this class. Generally this is only useful
   * if applied to child class of `Enumeration`.
   *
   * @returns {Generator<string, void, *>} an iterator that walks instances
   * of derived {@link Enumeration} classes and returns their `.value` values
   */
  static *values() {
    for (let [_, value] of this) yield value;
  }

  /**
   * Creates an iterator of all {@link Enumeration} derived instances that
   * are statically assigned to this class. Generally this is only useful
   * if applied to child class of `Enumeration`.
   *
   * @returns {Generator<*, void, *>} an iterator that walks instances
   * of derived {@link Enumeration} classes and returns each key/value pair
   * as arrays. **This is the same as `Object.entries(ChildEnumerationClass)`
   * and then filter the results for pairs whose values are instances of
   * `ChildEnumerationClass`**
   */
  static *[Symbol.iterator]() {
    const keys = Object.keys(this);

    for (const key of keys) {
      const value = this[key];

      if (value instanceof this) yield [key, value];
    }
  }
}

/**
 * Creates a prototype safe {@link Proxy} object, specific to
 * {@link Enumeration} instances, that if a getter tries to reach a named
 * property that doesn't exist on the enum, **and** `.hasAssociatedValues`
 * is `true`, then it will attempt to return `this.associations[property]`
 * instead.
 *
 * @param {object} proxied the object to the behavior to; typically this is
 * the prototype of the class itself. See the constructor in Enumeration for
 * usage.
 * @returns {*|null|object} a {@link Proxy} instance around the supplied
 * object to be proxied with the above defined behavior.
 */
export function SubscriptProxy(proxied) {
  const has = (object, property) => Reflect.has(object, property)

  return new Proxy(proxied, {
    get(target, property, receiver) {
      // First, if our target does not have a property with the
      // requested, check, in order, the following:
      //   1. The instance's associations object.
      //   2. The instance's value, if it's an object.
      if (!Reflect.has(target, property)) {
        // If the associations object has a property of a given name
        // return it first
        if (has((receiver?.associations ?? {}),property))
          return receiver.associated(property);

        // If we are still here and the value is an object and it has
        // a property with the supplied name, return it.
        if (is.object(receiver.value) && has(receiver.value, property))
          return receiver.value[property];
      }

      // If we failed above or in all other cases, provide
      // the default experience for handling property access
      return Reflect.get(target, property, receiver);
    },

    set(target, property, newValue, receiver) {
      if (
        !Reflect.has(target, property) &&
        receiver.hasAssociatedValues &&
        Reflect.has(receiver.associations, property)
      ) {
        receiver.associations[property] = newValue
        return true
      }

      return Reflect.set(target, property, newValue, receiver);
    },
  });
}

export default Enumeration

/**
 * @typedef {object} TypeToolbox
 *
 * @property {function(any): boolean} object a function that takes any value
 * and returns a boolean value if the object is of type `'object'` and not null
 * @property {function(any): boolean} function a function that takes any value
 * and returns true if is of type `'function'` or is an `instanceof`
 * {@link Function}.
 * @property {function(any): boolean} array a pass-thru to the
 * {@link Array#isArray} function.
 * @property {function(any): boolean} number a function that takes any value
 * and returns `true` if the value is a number, and `false` otherwise.
 * @property {function(any): boolean} objectEntry a function that takes any
 * value and returns true if the object is a 2 element array where the first
 * parameter is one of a string, symbol, or number type. The second parameter
 * can be of any type. If these criteria are not met, false is returned.
 * @property {function(any): boolean} objectKey a function that takes any value
 * and returns true if it is of type symbol, string, or number. Any other type
 * results in a false return value.
 */
