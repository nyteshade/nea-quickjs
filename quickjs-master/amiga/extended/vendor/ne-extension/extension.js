import { CannotBeExtendedError } from "./errors/CannotBeExtendedError.js"
import { MissingOwnerValue } from './errors/MissingOwnerValue.js'
import { Patch } from './patch.js'

/** Shared array of primitive types for use with `isPrimitive` */
const primitives = ['number', 'boolean', 'bigint', 'string', 'symbol']

/**
 * The Extension class, inheriting from the Patch class, is specifically designed
 * for extending properties or methods of a given object. It facilitates the
 * extension process by determining the target key and value for the extension and
 * ensuring the target property is writable and configurable. If these conditions
 * are not met, the class throws a CannotBeExtendedError. This class is useful
 * in scenarios like testing, dynamic behavior adjustments, or managing complex
 * object configurations.
 *
 * @template E
 */
export class Extension extends Patch {
  /**
   * An extension wraps a class or function, if it has been determined that the
   * wrapped object is a class, it will be stored in this property.
   *
   * @type {E}
   */
  class;

  /**
   * An extension wraps a class or function, if it has been determined that the
   * wrapped object is a function, it will be stored in this property.
   *
   * @type {function}
   */
  function;

  /**
   * Constructs a new Extension instance. This constructor initializes the extension
   * by determining the target key and value for the extension and ensuring that
   * the property to be extended is configurable and writable. It throws an error
   * if these conditions are not satisfied. The constructor leverages the Patch
   * class's functionalities to manage the extension effectively.
   *
   * @param {Function|string} keyClassOrFn - The key, class, or function to be
   * used for the extension. If a function or class is provided, its name is used
   * as the key.
   * @param {*} value - The value or method to be used for the extension.
   * @param {object} [owner=globalThis] - The object to which the extension will
   * be applied.
   * @param {object} [options={}] - Additional options for the extension behavior.
   * @throws {CannotBeExtendedError} If the target property is not writable or
   * configurable.
   * @throws {MissingOwnerValue} If the `keyClassOrFn` value is null or there
   * is an error determining the key and extension values, MissingOwnerValue is
   * thrown.
   */
  constructor(
    keyClassOrFn,
    value = undefined,
    owner = globalThis,
    options = {}
  ) {
    const metadata = Extension.determineInput(keyClassOrFn)
    let { key, extension, valid } = metadata

    extension = value || extension

    if (!valid) {
      throw new MissingOwnerValue(owner, key)
    }

    const descriptor = Object.getOwnPropertyDescriptor(owner, key)
    if (descriptor) {
      if (
        (Reflect.has(descriptor, 'writable') && !descriptor.writable) ||
        (Reflect.has(descriptor, 'configurable') && !descriptor.configurable)
      ) {
        throw new CannotBeExtendedError(owner, key)
      }
    }

    super(owner, { [key]: extension }, options)
    this.key = key

    this.class = metadata.class
    this.function = metadata.function
  }

  /**
   * Returns true if this `Extension` represents a `function`
   *
   * @returns {boolean} `true` if this `Extension` introduces a `function`, or
   * `false` if it does not
   */
  get isFunction() { return !!(this.function) }

  /**
   * Returns true if this `Extension` represents a `class`
   *
   * @returns {boolean} `true` if this `Extension` introduces a `class`, or
   * `false` if it does not
   */
  get isClass() { return !!(this.class) }

  /**
   * Returns true if this `Extension` represents a `primitive`
   *
   * @returns {boolean} `true` if this `Extension` introduces a
   * primitive value or `false` if it does not.
   */
  get isPrimitive() {
    return !!(~primitives.indexOf(typeof this.value))
  }

  /**
   * Returns true if this `Extension` represents a value that is not
   * coerced into an `Object` wrapper when wrapped with `Object(value)`
   *
   * @returns {boolean} `true` if this `Extension` introduces a value
   * that is already an `object`, `false` otherwise.
   */
  get isObject() {
    return Object(this.value) === this.value
  }

  /**
   * A static getter that provides a proxy to manage and interact with the
   * patches that have been applied globally. This proxy abstracts the
   * underlying details and presents a simplified interface for querying and
   * manipulating applied patches. It is particularly useful in IDEs, as it
   * allows developers to access the state of applied patches without needing
   * to delve into the source code.
   *
   * @returns {Object} An object showing all the keys known to be patched for
   * the default owner, `globalThis`
   */
  static get applied() {
    return Patch.applied;
  }

  /**
   * A static getter that provides access to a proxy representing all known
   * patches, whether applied or not. This is useful for inspecting the
   * complete set of patches that have been registered in the system, without
   * limiting the view to only those that are currently active. The proxy
   * abstracts the underlying details and presents a simplified interface for
   * querying and manipulating the patches.
   *
   * @returns {Proxy} A proxy object that represents a virtual view of all
   * registered patches, allowing for operations like checking if a patch is
   * known and retrieving patch values.
   */
  static get known() {
    return Patch.known;
  }

  /**
   * A static getter that provides access to a proxy for managing patch
   * entries with a toggle functionality. This proxy allows the temporary
   * application of patches within a certain scope, and automatically reverts
   * them after the scope ends. It is useful for applying patches in a
   * controlled manner, ensuring that they do not remain active beyond the
   * intended usage.
   *
   * @returns {Proxy} A proxy object that represents a virtual view of the
   * patches with toggle functionality, allowing for temporary application
   * and automatic reversion of patches.
   */
  static get use() {
    return Patch.use;
  }

  /**
   * A static getter that provides access to a proxy for managing patch
   * entries with lazy initialization. This proxy defers the creation and
   * application of patches until they are explicitly requested. It is
   * beneficial for performance optimization, as it avoids the overhead of
   * initializing patches that may not be used.
   *
   * @returns {Proxy} A proxy object that represents a virtual view of the
   * patches with lazy initialization, allowing patches to be created and
   * applied only when needed.
   */
  static get lazy() {
    return Patch.lazy;
  }


  /**
   * Returns an object with getters to access different proxy views of patches
   * scoped to a specific owner. This allows for interaction with patches
   * that are either applied, known, or used within a certain scope, providing
   * a controlled environment for patch management.
   *
   * @param {object} owner - The object to scope the patch proxies to.
   * @returns {object} An object containing getters for `applied`, `known`,
   * and `use` proxies:
   * - `applied`: Proxy for patches applied to the owner.
   * - `known`: Proxy for all patches known to the owner, applied or not.
   * - `use`: Proxy that allows temporary application of patches.
   */
  static scopedTo(owner) {
    return Patch.scopedTo(owner);
  }

  /**
   * Determines the input type for the extension. This method processes the input
   * and identifies the key for the extension and the associated value or method.
   * It supports inputs as either a string key or a function/class, providing
   * flexibility in defining extensions.
   *
   * @param {Function|string} keyClassOrFn - The key, class, or function provided
   * as input. If a function or class is provided, its name is used as the key.
   * containing the determined key, the extension value/method, and a validity flag
   * indicating whether the input is usable.
   * @returns {{
   *   key: string|null,
   *   extension: *|null,
   *   valid: boolean,
   *   class: Function|undefined,
   *   function: function|undefined,
   * }} an object
   */
  static determineInput(keyClassOrFn) {
    const input = {
      key: null,
      extension: null,
      valid: false,
      class: undefined,
      function: undefined,
    }

    if (keyClassOrFn instanceof Function) {
      Object.assign(input, {
        key: keyClassOrFn.name,
        extension: keyClassOrFn,
        valid: true
      })

      if (/^class .*/.exec(keyClassOrFn.toString())) {
        input.class = keyClassOrFn
      }

      if (/^(async )?function .*/.exec(keyClassOrFn.toString())) {
        input.function = keyClassOrFn
      }
    }
    else if (typeof keyClassOrFn === 'string' || keyClassOrFn instanceof String) {
      Object.assign(input, {
        key: keyClassOrFn,
        valid: true
      })
    }

    return input
  }

  /**
   * Custom inspect function for Node.js that provides a formatted representation
   * of the Extension instance, primarily for debugging purposes.
   *
   * @param {number} depth The depth to which the object should be formatted.
   * @param {object} options Formatting options.
   * @param {function} inspect The inspection function to format the object.
   * @returns {string} A formatted string representing the Extension instance.
   */
  [Symbol.for('nodejs.util.inspect.custom')](depth, options, inspect) {
    const expression = {
      get braces() { return /^(\x1B\[\d+m)?[\[{]|[\]}](\x1B\[\d+m)?$/g },
    }

    const val = inspect(this.patches[this.key], options).replaceAll(
      expression.braces,
      '$1$2'
    )

    return `Extension[${val}]`
  }

  /**
   * Custom getter for the toStringTag symbol. Provides the class name when the
   * object is converted to a string, typically used for debugging and logging.
   *
   * @returns {string} The class name of the Extension instance.
   */
  get [Symbol.toStringTag]() {
    return this.constructor.name
  }

  /**
   * Creates a new ExtensionSet with the provided name and extensions.
   *
   * @param {string} name - The name of the extension set.
   * @param {...Extension|Function} extensions - A list of extensions or
   * functions to include in the set.
   * @returns {ExtensionSet} A new instance of ExtensionSet containing the
   * given extensions.
   */
  static createSet(name, ...extensions) {
    return new Extension.ExtensionSet(name, ...extensions)
  }

  /**
   * Represents a set of extensions.
   */
  static ExtensionSet = class ExtensionSet {
    /**
     * Creates an instance of ExtensionSet.
     *
     * @param {string} name - The name of the extension set.
     * @param {...(Extension|Function)} extensions - Extensions or functions to
     * add to the set.
     */
    constructor(name, ...extensions) {
      this.name = name;
      this.extensionObjects = new Set();
      this.extensions = new Set();

      for (const extensionValue of extensions) {
        if (extensionValue instanceof Extension) {
          this.extensions.add(extensionValue);
          this.extensionObjects.add(extensionValue.patches[extensionValue.key]);
        } else if (extensionValue instanceof Function) {
          this.extensionObjects.add(extensionValue);
          this.extensions.add(new Extension(extensionValue));
        }
      }
    }

    /**
     * Applies all extensions in the set.
     */
    apply() {
      for (const extension of this.extensions) {
        extension.apply();
      }
    }

    /**
     * Reverts all extensions in the set.
     */
    revert() {
      for (const extension of this.extensions) {
        extension.revert();
      }
    }
  }
}