/** Small utility to fetch name of class or type */
const typeOf = o => /(\w+)]/.exec(Object.prototype.toString.call(o))[1]

/**
 * Represents an error that is thrown when there is an attempt to extend a
 * restricted part of the code. This error is specifically used to signal
 * violations of extension constraints, such as tampering with certain keys
 * or properties of an object. The error message constructed will include the
 * details of the owner (the restricted part) and the key that was attempted to
 * be tampered with.
 */
export class CannotBeExtendedError extends Error {
  /**
   * Constructs a new CannotBeExtendedError instance.
   *
   * @param {object} owner The name or identifier of the restricted part
   * that is disallowing extension or tampering.
   * @param {string} key The key or property that was attempted to be
   * modified or extended.
   */
  constructor(owner, key) {
    super(`${typeOf(owner)} disallows tampering with ${key}.`)
    Object.assign(this, { owner, key })
  }

  /**
   * Custom getter for the toStringTag symbol. Overrides the default
   * Object.prototype.toString behavior, returning the constructor's name
   * of this error instance. Useful for debugging and logging purposes.
   * @returns {string} The name of the constructor for this error instance.
   */
  get [Symbol.toStringTag]() {
    return this.constructor.name
  }
}
