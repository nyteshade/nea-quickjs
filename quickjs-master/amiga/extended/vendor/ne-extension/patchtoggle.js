import { Patch } from "./patch.js";

/**
 * Early usage of the Patch and Extension classes made it clear that it was
 * cumbersome to use a Patch temporarily for a block of code and excessive
 * amounts of if/else statements were required. This simple wrapper makes that
 * process easier.
 */
export class PatchToggle {
  /**
   * Wraps an instance of a Patch. It allows low-code clean-readability to
   * start and stop the underlying patch regardless of whether or not the
   * patch has been already applied.
   *
   * @param {Patch} patch instance of `Patch` to wrap with this toggle
   * @param {boolean} preventRevert prevents the call to `.revert()` on the
   * supplied patch when stop() is called.
   */
  constructor(patch, preventRevert = false) {
    this.started = false
    this.preventRevert = preventRevert
    this.patch = patch
    this.patchName = (
      patch.owner?.name ??
      patch.owner?.constructor?.name ??
      /(\w+)]/.exec(Object.prototype.toString.call(patch.owner))[1]
    )
    this.state = {
      needsApplication: false,
      needsReversion: false,
    }
  }

  /**
   * If the usage of the wrapped Patch hasn't been started yet, the code checks
   * whether or not the patch has been applied by checking for signs of it in
   * the owning object.
   *
   * If the patch needs to be applied, it will be applied at this time.
   *
   * @returns {PatchToggle} returns `this` to allow for chaining
   */
  start() {
    if (!this.started) {
      this.state.needsApplication = !this.patch.applied
      this.state.needsReversion = this.patch.applied
      this.started = true

      if (this.state.needsApplication) {
        this.patch.apply()
      }
    }

    return this
  }

  /**
   * Performs a task with the wrapped patch. If the patch hasn't been
   * started, it will be started. If the patch doesn't need to be
   * reverted, it will be stopped after the task is complete.
   *
   * @param {Function} task a function that takes the `PatchToggle`
   * instance and the wrapped `Patch` instance as parameters. By
   * default, this is an empty function.
   * @returns {*} the result of the `task` function
   *
   * @example
   * const result = toggle.perform((toggle, patch) => {
   *   // do something with `toggle` and `patch`
   *   return "done"
   * })
   * console.log(result) // outputs: "done"
   */
  perform(task = (toggle, patch) => {}) {
    if (!this.state.needsApplication) {
      this.start()
    }

    const result = task(this, this.patch)

    if (!this.state.needsReversion) {
      this.stop()
    }

    return result
  }

  /**
   * Checks to see if the toggle has been started. If so, the patch is reverted
   * if it needed to be applied previously. After stopping, the state of the instance
   * is reverted to allow for clean subsequent calls to start.
   *
   * @returns {PatchToggle} returns `this` to allow further chaining
   */
  stop() {
    if (this.started) {
      if (this.preventRevert || this.patch.applied) {
        this.patch.revert()
      }

      this.state.needsApplication = false
      this.state.needsReversion = false
      this.started = false
    }

    return this
  }

  /**
   * When the string tag for this class instance is inspected, it will
   * reflect the string `PatchToggle:PatchName`
   */
  get [Symbol.toStringTag]() {
    return `${this.constructor.name}:${this.patchName}`
  }

  /**
   * Custom inspect function for Node.js that provides a formatted representation
   * of the PatchToggle instance, primarily for debugging purposes.
   *
   * @param {number} depth The depth to which the object should be formatted.
   * @param {object} options Formatting options.
   * @param {function} inspect The inspection function to format the object.
   * @returns {string} A formatted string representing the PatchEntry instance.
   */
  [Symbol.for('nodejs.util.inspect.custom')](depth, options, inspect) {
    const objName = this[Symbol.toStringTag]
    const status = `(started: ${this.started} needed: ${this.state.needsApplication})`

    return inspect(`${objName} ${status}`, {...options, depth})
  }
}