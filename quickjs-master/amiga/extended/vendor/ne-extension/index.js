export { Extension } from './extension.js'
export { Patch } from './patch.js'
export { PatchEntry } from './patchentry.js'
export { PatchToggle } from './patchtoggle.js'
export { SemVer } from './semver.js'

import { CannotBeExtendedError } from './errors/CannotBeExtendedError.js'
import { MissingOwnerValue } from './errors/MissingOwnerValue.js'

/**
 * A namespace object containing the errors used by this project.
 *
 * @type {{
 *   readonly CannotBeExtended: CannotBeExtendedError,
 *   readonly MissingOwnerValue: MissingOwnerValue
 * }}
 */
export const Errors = {
  /**
   * Returns an error constructor that represents a situation where an object
   * cannot be extended or modified.
   *
   * @returns {CannotBeExtendedError}
   */
  get CannotBeExtended() { return CannotBeExtendedError },

  /**
   * Returns an error constructor that represents a situation where an object
   * an invalid owner was provided when creating a new {@link Extension}
   * instance.
   *
   * @returns {MissingOwnerValue}
   */
  get MissingOwnerValue() { return MissingOwnerValue },
}
