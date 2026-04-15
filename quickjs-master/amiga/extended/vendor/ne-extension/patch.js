import { PatchToggle } from './patchtoggle.js'
import { PatchEntry } from './patchentry.js'

/**
 * The Patch class provides a mechanism to apply patches to properties or
 * methods of an object (the owner). It keeps track of the original state of
 * these properties and allows for the application and reversion of patches.
 */
export class Patch {
  /**
   * A record of conflicts between existing and patched properties or methods.
   * This object maps property names to their respective PatchEntry instances,
   * which contain information about the original and patched values.
   *
   * @type {object}
   */
  patchConflicts = Object.create(null)

  /**
   * An object to store patch entries. Each key corresponds to a property or
   * method name on the owner object, and the value is the associated
   * PatchEntry instance which contains the patched and original values.
   *
   * @type {object}
   */
  patchEntries = Object.create(null)

  /**
   * The object containing the patches to be applied to the owner. It is
   * initially undefined and will be populated with the patches passed to the
   * constructor.
   *
   * @type {object}
   */
  patchesOwner = undefined

  /**
   * The count of patches that have been applied. This is incremented
   * each time a patch is applied and decremented when a patch is
   * reverted.
   *
   * @type {number}
   */
  patchCount = 0

  /**
   * The number of patches that have been successfully applied. This count
   * is incremented after each successful patch application and decremented
   * when a patch is reverted.
   *
   * @type {number}
   */
  patchesApplied = 0


  /**
   * The `displayName` property is used to store a human-readable name for the
   * Patch instance. This name can be used for logging or debugging purposes to
   * easily identify the patch in a more meaningful way than a generic identifier
   * or memory reference. It is initially set to `undefined` and can be updated
   * to any string value as needed.
   *
   * @type {string|undefined}
   */
  ownerDisplayName = undefined

  /**
   * Constructs a new Patch instance. Supported options for Patch instances
   * include either a global condition for the Patch to be applied or
   * specific property conditions subjecting only a subset of the patches
   * to conditional application.
   *
   * @example
   * ```
   * const custom = Symbol.for('nodejs.util.inspect.custom')
   * const patch = new Patch(
   *   Object,
   *   {
   *     property: 'value',
   *     [custom](depth, options, inspect) {
   *       // ... custom return string for NodeJS
   *     }
   *   },
   *   {
   *     conditions: {
   *       [custom]() { return process?.versions?.node !== null },
   *     },
   *   }
   * )
   * patch.apply() // applies `property` but only applies the `custom`
   *               // property if the JavaScript is running in NodeJS
   * ```
   *
   * @param {object} owner The object to which patches will be applied.
   * @param {object} patches An object containing properties or methods to
   *                         be patched onto the owner.
   * @param {object} [options=Object.create(null)] Additional options for
   * patching behavior.
   */
  constructor(owner, patches, options = Object.create(null)) {
    Object.assign(this, {
      owner,
      options,
    })

    this.ownerDisplayName = options?.displayName ?? Patch.extractName(owner)
    this.patchesOwner = Patch.constructWithStore(patches, this)
    this.generatePatchEntries(this.patchesOwner)

    if (!Patch.patches.has(owner)) {
      Patch.patches.set(owner, [])
    }

    Patch.patches.get(owner).push(this)
  }

  /**
   * Iterates over the properties of `patchesOwner` and attempts to generate
   * patches based on the provided conditions and overrides. This method
   * supports conditional patching, allowing patches to be applied only if
   * certain conditions are met. It also handles descriptor overrides for
   * patch symbols, enabling custom behavior for patched properties.
   *
   * @param {object} patchesOwner The object containing the patches to be
   * applied. Each key in this object represents a property to be patched.
   * @param {object} [overrides] Optional. An object containing descriptor
   * overrides for the properties to be patched. If not provided, overrides
   * will be determined based on patch symbols.
   */
  generatePatchEntries(patchesOwner, overrides = undefined) {
    const globalCondition = this?.options.condition

    Reflect.ownKeys(patchesOwner).forEach(key => {
      const condition = this?.options?.conditions?.[key] ?? globalCondition

      try {
        const useOverrides = (
          overrides ??
          Patch.getDescriptorOverridesFromSymbol(key)
        );
        let useOwner = patchesOwner;

        if (Patch.isKnownPatchSymbol(key)) {
          useOwner = Patch.constructWithStore(patchesOwner[key], this, key)
          patchesOwner[key] = useOwner
          this.generatePatchEntries(useOwner, useOverrides);
          return;
        }

        this.patchEntries[key] = new PatchEntry(
          key, patchesOwner, condition, overrides
        )
        this.patchCount += 1
      }
      catch (error) {
        console.error(`Failed to process patch for ${String(key)}\n`, error)
      }

      if (Reflect.has(this.owner, key)) {
        try {
          this.patchConflicts[key] = new PatchEntry(key, this.owner)
        }
        catch (error) {
          console.error(`Cannot capture conflicting patch key ${key}\n`, error)
        }
      }
    })
  }

  /**
   * Retrieves the patch entries as an array of [key, patchEntry] pairs.
   *
   * @returns {[string|symbol|number, any][]} An array of [key, patchEntry]
   * pairs.
   */
  get entries() {
    return Reflect.ownKeys(this.patchEntries).map(key => {
      return [key, this.patchEntries[key]]
    })
  }

  /**
   * Retrieves an array of patch entries that have been successfully applied.
   * Each entry is a key-value pair array where the key is the patch identifier
   * and the value is the corresponding `PatchEntry` object. Only patches with
   * a state of `true` in `patchState` are included, indicating they are
   * currently applied to the owner object.
   *
   * @returns {Array} An array of [key, patchEntry]
   * pairs representing the applied patches.
   */
  get appliedEntries() {
    return Reflect.
      ownKeys(this.patchEntries).
      filter(key => this.patchState.get(key) === true).
      map(key => {
        return [key, this.patchEntries[key]]
      })
  }

  /**
   * Retrieves an array of patch entries that have not been applied. Each entry
   * is a key-value pair array where the key is the patch identifier and the
   * value is the corresponding `PatchEntry` object. Only patches with a state
   * of `false` in `patchState` are included, indicating they are not currently
   * applied to the owner object.
   *
   * @returns {Array} An array of [key, patchEntry]
   * pairs representing the unapplied patches.
   */
  get unappliedEntries() {
    return Reflect.
      ownKeys(this.patchEntries).
      filter(key => this.patchState.get(key) === false).
      map(key => {
        return [key, this.patchEntries[key]]
      })
  }

  /**
   * Depending on how the PatchEntry is configured, accessing the patch
   * by name can be somewhat irritating, so this provides an object with
   * the actual current patch value at the time patchValues is requested.
   *
   * @example let { patch1, patch2 } = patch.patchValues
   * @returns {object} an object with the patchName mapped to the current
   * computed patchEntry value.
   */
  get patches() {
    return this.entries.reduce((acc, [key, patchEntry]) => {
      acc[key] = patchEntry.computed
      return acc
    }, Object.create(null))
  }

  /**
   * Retrieves an object containing all patches that have been successfully
   * applied. The object's keys are the patch keys, and the values are the
   * computed values of the corresponding patch entries. Only patches with
   * a state of `true` in `patchState` are considered applied.
   *
   * @returns {object} An object mapping each applied patch key to its
   * computed value.
   */
  get appliedPatches() {
    return this.entries.reduce((acc, [key, patchEntry]) => {
      if (this.patchState.get(key) === true) {
        acc[key] = patchEntry.computed
      }
      return acc
    }, Object.create(null))
  }

  /**
   * Retrieves an object containing all patches that have not been applied.
   * The object's keys are the patch keys, and the values are the computed
   * values of the corresponding patch entries. Only patches with a state
   * of `false` in `patchState` are considered unapplied.
   *
   * @example
   * // Assuming `patch` is an instance of `Patch` and `patch1` is unapplied:
   * let unapplied = patch.unappliedPatches;
   * console.log(unapplied); // { patch1: computedValueOfPatch1 }
   *
   * @returns {object} An object mapping each unapplied patch key to its
   * computed value.
   */
  get unappliedPatches() {
    return this.entries.reduce((acc, [key, patchEntry]) => {
      if (this.patchState.get(key) === false) {
        acc[key] = patchEntry.computed
      }
      return acc
    }, Object.create(null))
  }

  /**
   * Retrieves an array of patch keys.
   *
   * This getter returns an array containing only the keys of the patch entries,
   * which can be useful for iterating over the patches or checking for the
   * existence of specific patches by key.
   *
   * @returns {string[]} An array of patch keys.
   */
  get patchKeys() {
    return this.entries.map(([key, _]) => key)
  }

  /**
   * Generates a list of entries with enhanced string representations. This
   * getter iterates over the `entries` property, transforming each [key, value]
   * pair into a more informative string object. This is particularly useful
   * for debugging or logging, as it provides a clear, readable format for
   * each entry. The string representation includes the entry's key and value,
   * with the key being converted to a string using its `Symbol.toStringTag`,
   * `name` property, or a direct string conversion as fallback.
   *
   * Each value in the resultant array additionally has '.key', `.value`,
   * `.entry` and `.entries` accessors. The `.key` is the `owner` object, the
   * `.value` is the `PatchEntry` instance. The entry accessor provides the
   * key and value in an array as one might expect to find the
   * `Object.entries()` array and `.entries` is the same as `[stringRef.entry]`
   * or `[[key, value]]`.
   *
   * @returns {Array} An array of string objects, each representing an entry
   * from the `entries` property. Each string object is enhanced with additional
   * properties and methods for improved usability and debugging.
   */
  get prettyEntries() {
    /** @type {Array<object>} */
    const prettyEntries = this.entries.map(([key, value]) => Patch.stringRef(
      Patch.extractName(key),
      key,
      value
    ))

    Object.defineProperty(prettyEntries, 'asEntries', {
      get() { return this.map(pe => pe.entry) },
      enumerable: false,
      configurable: true,
    })

    return prettyEntries
  }

  /**
   * Retrieves the conflict entries (existing properties on the owner that
   * patches will override) as an array of [key, patchEntry] pairs.
   *
   * @returns {Array} An array of [key, patchEntry] pairs.
   */
  get conflicts() {
    return Reflect.ownKeys(this.patchConflicts).map(key => {
      return [key, this.patchConflicts[key]]
    })
  }

  /**
   * Checks to see if the tracked number of applied patches is greater than 0
   *
   * @returns {boolean} true if at least one patch has been applied
   */
  get applied() {
    return this.patchesApplied > 0
  }

  /**
   * Provided for semantics, but this method is synonymous with {@link applied}.
   *
   * @returns {boolean} true if at least one patch has been applied
   */
  get isPartiallyPatched() {
    return this.applied
  }

  /**
   * Returns true only when the number of tracked patches matches the number
   * of applied patches.
   *
   * @returns {boolean} true if applied patches are equal to the count of
   * patches
   */
  get isFullyPatched() {
    return this.patchCount == this.patchesApplied
  }

  /**
   * Applies all patches to the owner object. If a property with the same key
   * already exists on the owner, it will be overridden. Optionally a callback
   * can be supplied to the call to revert. If the callback is a valid function,
   * it will be invoked with an object containing the results of the reversion
   * of the patch. The callback receives a single parameter which is an object
   * of counts. It has the signature:
   *
   * ```
   * type counts = {
   *   patches: number;
   *   applied: number;
   *   errors: Array<PatchEntry,Error>;
   *   notApplied: number;
   * }
   * ```
   *
   * While the keys may be obvious to some, `patches` is the count of patches
   * this instance tracks. `applied` is the number of patches that were applied
   * 'errors' is an array of arrays where the first element is the `PatchEntry`
   * and the second element is an `Error` indicating the problem. An error will
   * only be generated if `isAllowed` is `true` and the patch still failed to
   * apply Lastly `notApplied` is the number of patches that were unable to
   * be applied.
   *
   * Additional logic that should track
   * ```
   *   • patches should === applied when done
   *   • errors.length should be 0 when done
   *   • notApplied should be 0 when done
   * ```
   *
   * @param {function} metrics - a callback which receives a status of the
   * `revert` action if supplied. This callback will not be invoked, nor will
   * any of the other logic be captured, if {@link applied} returns false
   */
  apply(metrics = undefined) {
    const entries = this.entries
    const counts = {
      patches: entries.length,
      applied: 0,
      errors: [],
      notApplied: entries.length,
    }

    this.patchState.clear()

    entries.forEach(([,patch]) => {
      if (patch.isAllowed) {
        // Patch
        Object.defineProperty(this.owner, patch.key, patch.descriptor)

        // Verify
        let oDesc = Object.getOwnPropertyDescriptor(this.owner, patch.key)
        if (this.#equalDescriptors(oDesc, patch.descriptor)) {
          counts.applied += 1
          counts.notApplied -= 1

          this.patchState.set(patch, true)

        }
        else {
          counts.errors.push([patch, new Error(
            `Could not apply patch for key ${patch.key}`
          )])
          this.patchState.set(patch, false)
        }
      }
      else {
        this.patchState.set(patch, false)
      }
    })

    this.patchesApplied = counts.applied

    if (typeof metrics === 'function') {
      metrics(counts)
    }
  }

  /**
   * Creates an easy to use toggle for working with `Patch` classes
   *
   * @param {boolean} preventRevert true if calling stop() on the toggle does not
   * revert the patch. false, the default, if it should.
   * @returns {PatchToggle} an instance of PatchToggle wrapped around this instance
   * of `Patch`
   * @example const toggle = ObjectExtensions.createToggle().start()
   */
  createToggle(preventRevert = false) {
    return new PatchToggle(this, preventRevert)
  }

  /**
   * Reverts all applied patches on the owner object, restoring any overridden
   * properties to their original state. Optionally a callback can be supplied to
   * the call to revert. If the callback is a valid function, it will be invoked
   * with an object containing the results of the reversion of the patch. The
   * callback receives a single parameter which is an object of counts. It has
   * the signature:
   *
   * ```
   * type counts = {
   *   patches: number;
   *   reverted: number;
   *   restored: number;
   *   conflicts: number;
   *   errors: Array<PatchEntry,Error>;
   *   stillApplied: number;
   * }
   * ```
   *
   * While the keys may be obvious to some, `patches` is the count of patches
   * this instance tracks. `reverted` is the number of patches that were removed'
   * `restored` is the number of originally conflicting keys that were restored.
   * `conflicts` is the total number of conflicts expected. `errors` is an array of
   * arrays where the first element is the `PatchEntry` and the second element
   * is an `Error` indicating the problem. Lastly `stillApplied` is the number of
   * patchesApplied still tracked. If this is greater than zero, you can assume
   * something went wrong.
   *
   * Additional logic that should track
   * ```
   *   • patches should === reverted when done
   *   • restored should === conflicts when done
   *   • errors.length should be 0 when done
   *   • stillApplied should be 0 when done
   * ```
   *
   * @param {function} metrics - a callback which receives a status of the
   * `revert` action if supplied. This callback will not be invoked, nor will
   * any of the other logic be captured, if {@link applied} returns false
   */
  revert(metrics) {
    if (!this.applied) {
      return
    }

    const entries = this.entries
    const conflicts = this.conflicts

    const counts = {
      patches: entries.length,
      reverted: 0,
      restored: 0,
      conflicts: conflicts.length,
      errors: [],
      stillApplied: 0,
    }

    entries.forEach(([,patch]) => {
      const successful = delete this.owner[patch.key]
      if (successful) {
        this.patchesApplied -= 1
        counts.reverted += 1
        this.patchState.set(patch, false)
      }
      else {
        counts.errors.push([patch, new Error(
          `Failed to revert patch ${patch.key}`
        )])
      }
    })

    conflicts.forEach(([,patch]) => {
      Object.defineProperty(this.owner, patch.key, patch.descriptor)
      const appliedDescriptor = Object.getOwnPropertyDescriptor(this.owner, patch.key)
      if (this.#equalDescriptors(patch.descriptor, appliedDescriptor)) {
        counts.restored += 1
      }
      else {
        counts.errors.push([patch, new Error(
          `Failed to restore original ${patch.key}`
        )])
      }
    })

    counts.stillApplied = this.patchesApplied
    if (typeof metrics === 'function') {
      metrics(counts)
    }
  }

  /**
   * Removes this Patch instance from being tracked amongst all the tracked Patch
   * instances. The JavaScript virtual machine will clean this instance up once
   * nothing else is holding a reference to it.
   */
  release() {
    const patches = Patch.patches.get(this.owner)

    patches.splice(patches.find(e => e === this), 1)
  }

  /**
   * The object to which the patches are applied.
   */
  owner = null;

  /**
   * Additional options for patching behavior.
   */
  options = null;

  /**
   * Patches that are currently live and active will have true as their
   * value and inert or non-applied patches will have false as their
   * value. The key is always the associated {@link PatchEntry}.
   */
  patchState = new Map();

  /**
   * Creates an iterator for the patch entries, allowing the `Patch` instance to
   * be directly iterable using a `for...of` loop. Each iteration will yield a
   * `[key, patchEntry]` pair, where `key` is the property name and `patchEntry`
   * is the corresponding `PatchEntry` instance.
   *
   * @returns {Iterator} An iterator that yields `[key, patchEntry]` pairs.
   */
  [Symbol.iterator]() {
    return this.entries.values()
  }

  /**
   * Compares two property descriptor objects to determine if they are equivalent.
   *
   * This method checks if both descriptors have the same value for the
   * `configurable`, `enumerable`, `value`, `writable`, `get`, and `set`
   * properties. If any of these properties differ between the two descriptors,
   * the descriptors are considered not equivalent.
   *
   * @param {PropertyDescriptor} left - The first descriptor to compare.
   * @param {PropertyDescriptor} right - The second descriptor to compare.
   * @returns {boolean} - True if the descriptors are equivalent, false otherwise.
   * @private
   */
  #equalDescriptors(left, right) {
    if (!left || !right) {
      return false;
    }

    return (
      left.configurable === right.configurable &&
      left.enumerable === right.enumerable &&
      left.value === right.value &&
      left.writable === right.writable &&
      left.get === right.get &&
      left.set === right.set
    )
  }

  /**
   * Custom inspection function for Node.js that is called when `util.inspect`
   * is used to convert the instance to a string. This allows for customizing
   * the output of `util.inspect` for objects of this class.
   *
   * @param {number} _ The current depth of the inspection. If the depth
   * is less than the recurse times set, it will return the object itself,
   * otherwise it will return the inspected result.
   * @param {object} __ An object containing options for the inspection.
   * @param {function} ___ The inspection function provided by Node.js
   * that can be called to inspect other properties with the same options as
   * the original call.
   * @returns {string} A string representation of the instance tailored for
   * Node.js' `util.inspect`.
   */
  [Symbol.for('nodejs.util.inspect.custom')](_, __, ___) {
    const type = this.ownerDisplayName ?? ''
    const name = (type.length
      ? `[\x1b[32m${type}\x1b[39m]`
      : ''
    )
    const keys = (this.prettyEntries
      .map(entry => {
        return `\x1b[2;33m${entry}\x1b[22;39m`
      })
      .join(', ')
    )

    return `${this.constructor.name}${name} { ${keys} }`;
  }

  /**
   * A global mapping of all patches in play
   *
   * @type {Map<object, Patch[]>}
   */
  static patches = new Map()

  /**
   * Applies all patches associated with a given owner object. This method
   * is used to enable all patches for a specific owner if they have been
   * previously registered.
   *
   * @param {object} owner The object whose patches are to be applied.
   */
  static enableFor(owner) {
    if (Patch.patches.has(owner)) {
      for (const patch of Patch.patches.get(owner)) {
        patch?.apply()
      }
    }
  }

  /**
   * Enables patches for all static members registered in the system. This
   * method iterates over all registered owners, identifying those represented
   * by functions (typically static members or classes) and enables patches
   * specifically for them. It's particularly useful for activating patches
   * that are meant to modify or enhance static properties or methods of
   * classes.
   */
  static enableProbableStatics() {
    for (const owner of Patch.patches.keys()) {
      if (typeof owner !== 'function') {
        continue;
      }

      Patch.enableFor(owner);
    }
  }

  /**
   * Iterates over all registered owners and enables patches for those
   * identified as instance entities (non-functions). This method is
   * particularly useful for activating patches on instance-level properties
   * or methods of classes, without affecting static-level patches. It ensures
   * that only owners not represented by functions, typically instance members,
   * are targeted for patch enabling.
   */
  static enableProbableInstances() {
    for (const owner of Patch.patches.keys()) {
      if (typeof owner === 'function') {
        continue;
      }

      Patch.enableFor(owner);
    }
  }

  /**
   * Enables all patches for every owner currently registered in the system.
   * This static method iterates over all owners that have patches registered
   * and applies those patches by invoking `enableFor` on each owner. This
   * method is particularly useful when a global application of all patches
   * is required, without the need to manually enable them for each owner
   * individually.
   */
  static enableAll() {
    for (const owner of Patch.patches.keys()) {
      Patch.enableFor(owner);
    }
  }

  /**
   * Reverts all patches associated with a given owner object. This method
   * is used to disable all patches for a specific owner if they have been
   * previously applied.
   *
   * @param {object} owner The object whose patches are to be reverted.
   */
  static disableFor(owner) {
    if (Patch.patches.has(owner)) {
      for (const patch of Patch.patches.get(owner)) {
        patch?.revert()
      }
    }
  }

  /**
   * Disables all patches for every owner currently registered in the system.
   * This method iterates over all owners that have patches registered and
   * reverts those patches by invoking `disableFor` on each owner. It is
   * particularly useful when a global reversion of all patches is required,
   * without the need to manually disable them for each owner individually.
   */
  static disableAll() {
    for (const owner of Patch.patches.keys()) {
      Patch.disableFor(owner);
    }
  }

  /**
   * Iterates over all registered owners and disables patches for those
   * identified as static entities (functions). This method is particularly
   * useful for reverting patches to static methods or properties of classes,
   * without affecting instance-level patches. It ensures that only owners
   * represented by functions, typically static members, are targeted for
   * patch disabling.
   */
  static disableProbableStatics() {
    for (const owner of Patch.patches.keys()) {
      if (typeof owner !== 'function') {
        continue;
      }

      Patch.disableFor(owner);
    }
  }

  /**
   * Iterates over all registered owners and disables patches for those
   * not identified as static entities (functions). This method is
   * particularly useful for reverting patches applied to instance-level
   * properties or methods, ensuring that patches on static members remain
   * unaffected. It targets only owners not represented by functions,
   * typically instance members, for patch disabling.
   */
  static disableProbableInstances() {
    for (const owner of Patch.patches.keys()) {
      if (typeof owner === 'function') {
        continue;
      }

      Patch.disableFor(owner);
    }
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
    return this.#allPatchesForOwner(globalThis, true)
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
    return this.#allPatchesForOwner(globalThis, false)
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
    return this.#allPatchesForOwner(globalThis, false, true)
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
    return this.#allPatchesForOwner(globalThis, false, false, true)
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
    const allForOwner = (
      owner,
      appliedOnly,
      wrapInToggle = false,
      applyOnRequest = false
    ) => {
      return this.#allPatchesForOwner(
        owner,
        appliedOnly,
        wrapInToggle,
        applyOnRequest
      )
    }

    return {
      /**
       * Getter for a proxy that represents patches applied to the owner.
       * This proxy provides a simplified interface for interacting with
       * applied patches, such as checking their status or retrieving values.
       *
       * @returns {Proxy} A proxy to the applied patches.
       */
      get applied() {
        return allForOwner(owner, true, false)
      },

      /**
       * Getter for a proxy that represents all patches known to the owner,
       * whether they are applied or not. This proxy allows for querying
       * and manipulation of the patches without directly accessing them.
       *
       * @returns {Proxy} A proxy to all known patches.
       */
      get known() {
        return allForOwner(owner, false, false)
      },

      /**
       * Getter for a proxy that enables temporary application of patches
       * within a certain scope. The patches are automatically reverted
       * after the scope ends, ensuring controlled usage.
       *
       * @returns {Proxy} A proxy to patches with toggle functionality.
       */
      get use() {
        return allForOwner(owner, false, true)
      },

      /**
       * Getter for a proxy that represents patches that are not immediately
       * applied but are applied on request. This allows for patches to be
       * applied only when they are explicitly needed, potentially improving
       * performance by deferring the application of patches until necessary.
       *
       * @returns {Proxy} A proxy to patches that are applied on request.
       */
      get lazy() {
        return allForOwner(owner, false, false, true)
      },
    }
  }

  /**
   * Aggregates patches for a given owner into a single object, optionally
   * filtering by applied status and wrapping in a toggle function.
   *
   * This method collects all patches associated with the specified owner
   * and constructs an object where each patch is represented by its key.
   * If `onlyApplied` is true, only patches that are currently applied will
   * be included. If `wrapInToggle` is true, each patch will be represented
   * as a function that temporarily applies the patch when called.
   *
   * @param {object} owner the owner object whose patches are to be
   * aggregated.
   * @param {boolean} onlyApplied if true, only include patches that
   * are applied.
   * @param {boolean} [wrapInToggle=false] if true, wrap patches in a
   * toggle function for temporary application.
   * @param {boolean} [applyOnRequest=false] if true, installs a getter
   * that automatically applies the patch when accessed.
   * @returns {object} An object representing the aggregated patches, with
   * each patch keyed by its property name.
   * @private
   */
  static #allPatchesForOwner(
    owner,
    onlyApplied,
    wrapInToggle = false,
    applyOnRequest = false
  ) {
    return [...Patch.patches.values()].
      flat().
      filter(patch => patch.owner === owner).
      reduce((accumulator, patch) => {
        for (const [,patchEntry] of patch.entries) {
          if (onlyApplied && patch.patchState.get(patchEntry) !== true) {
            continue
          }

          if (wrapInToggle) {
            accumulator[patchEntry.key] = async (usage) => {
              if (typeof usage !== 'function') {
                return
              }

              const type = Object.prototype.toString.call(usage)
              const toggle = patch.createToggle()

              toggle.start()
              if('[object AsyncFunction]' === type) {
                await usage(patchEntry.computed, patchEntry)
              }
              else {
                usage(patchEntry.computed, patchEntry)
              }
              toggle.stop()
            }

            continue
          }

          if (applyOnRequest) {
            Object.defineProperty(accumulator, patchEntry.key, {
              get() {
                patch.apply()
                return patchEntry.computed
              },
              enumerable: true,
              configurable: true,
            });

            continue;
          }


          if (patchEntry.isAccessor) {
            let dynName = `applyAccessorFor_${String(patchEntry.key)}`
            let dynNameContainer = {
              [dynName](applyTo) {
                patchEntry.applyTo(applyTo)
                return applyTo
              }
            };

            accumulator[patchEntry.key] = dynNameContainer[dynName]
          }
          else {
            patchEntry.applyTo(accumulator)
          }
        }

        return accumulator
      }, Object.create(null))
  }

  /**
   * A getter for the custom inspect symbol used by Node.js.
   *
   * @returns {symbol} The custom inspect symbol.
   */
  static get CustomInspect() {
    return Symbol.for('nodejs.util.inspect.custom')
  }

  /**
   * Strips leading and trailing control characters, brackets, braces, and
   * quotes from a string. This is typically used to clean strings that may
   * have special characters or escape sequences that are not desired in the
   * output.
   *
   * @param {string} fromString The string to be stripped of extras.
   * @returns {string} The cleaned string with extras stripped.
   */
  static stripExtras(fromString) {
    return fromString
      .replaceAll(
        /^(\x1B\[\d+m)?[\[{]\s?|\s?[\]}](\x1B\[\d+m)?$/gm,
        '$1$2'
      )
      .replaceAll(
        /['"](.*?)['"]/gm,
        '$1'
      )
  }

  /**
   * Accessor for a Symbol uniquely representing properties that are
   * non-enumerable but configurable. This symbol can be used to tag
   * properties with these characteristics in a consistent manner across
   * different parts of the application.
   *
   * @returns {symbol} A Symbol for properties that are non-enumerable
   * but configurable.
   */
  static get kMutablyHidden() {
    return Symbol.for('{"enumerable":false,"configurable":true}')
  }

  /**
   * Applies a custom descriptor patch to an instance, marking properties as
   * non-enumerable but configurable. This method utilizes the `kMutablyHidden`
   * symbol to tag properties accordingly. It's useful for hiding properties
   * in a way that they remain configurable for future changes.
   *
   * @param {object} instance The object instance to apply the patch to.
   * @param {object} [store=Object.create(null)] An optional store object to
   * hold patched properties' original values and descriptors.
   * @returns {object} The result of applying the custom descriptor patch,
   * typically a modified version of the `store` object containing the patched
   * properties' descriptors.
   */
  static mutablyHidden(instance, store = Object.create(null)) {
    return this.customDescriptorPatch(instance, this.kMutablyHidden, store);
  }

  /**
   * Accessor for a Symbol uniquely representing properties that are both
   * enumerable and configurable. This symbol can be used to tag properties
   * with these characteristics in a consistent manner across different parts
   * of the application. The symbol is created or retrieved based on a
   * standardized JSON string, ensuring consistency in its representation.
   *
   * @returns {symbol} A Symbol for properties that are both enumerable and
   * configurable, allowing them to be listed in object property enumerations
   * and reconfigured or deleted.
   */
  static get kMutablyVisible() {
    return Symbol.for('{"enumerable":true,"configurable":true}')
  }

  /**
   * Applies a custom descriptor patch to an instance, marking properties as
   * both enumerable and configurable. This method leverages the `kMutablyVisible`
   * symbol to tag properties, making them visible in enumerations and allowing
   * them to be reconfigured or deleted. This is particularly useful for
   * properties that need to be exposed for iteration or manipulation while
   * maintaining the ability to modify their descriptors in the future.
   *
   * @param {object} instance The object instance to apply the patch to.
   * @param {object} [store=Object.create(null)] An optional store object to
   * hold patched properties' original values and descriptors. If not provided,
   * a new object will be used to store this information.
   * @returns {object} The result of applying the custom descriptor patch,
   * typically a modified version of the `store` object containing the patched
   * properties' descriptors.
   */
  static mutablyVisible(instance, store = Object.create(null)) {
    return this.customDescriptorPatch(instance, this.kMutablyVisible, store)
  }

  /**
   * Accessor for a Symbol uniquely identifying properties that are neither
   * enumerable nor configurable. This symbol is used to tag properties to
   * ensure they are hidden from enumeration and cannot be reconfigured or
   * deleted, providing a level of immutability. The symbol is generated or
   * retrieved based on a standardized JSON string, ensuring consistency
   * across different parts of the application.
   *
   * @returns {symbol} A Symbol for properties that are neither enumerable
   * nor configurable, effectively making them immutable and hidden from
   * property enumerations.
   */
  static get kImmutablyHidden() {
    return Symbol.for('{"enumerable":false,"configurable":false}')
  }

  /**
   * Applies a descriptor patch to an object instance, marking properties as
   * neither enumerable nor configurable. This method uses the `kImmutablyHidden`
   * symbol to tag properties, ensuring they remain hidden from enumerations
   * and cannot be reconfigured or deleted. This enhances property immutability
   * and privacy within an object. It's particularly useful for securing
   * properties that should not be exposed or altered.
   *
   * @param {object} instance The object instance to apply the patch to.
   * @param {object} [store=Object.create(null)] An optional store object to
   * hold patched properties' original values and descriptors. If not provided,
   * a new object will be used to store this information.
   * @returns {object} The result of applying the descriptor patch, typically
   * a modified version of the `store` object containing the patched properties'
   * descriptors.
   */
  static immutablyHidden(instance, store = Object.create(null)) {
    return this.customDescriptorPatch(instance, this.kImmutablyHidden, store)
  }

  /**
   * Accessor for a Symbol uniquely identifying properties that are visible
   * (enumerable) but not configurable. This symbol is used to tag properties
   * to ensure they are included in enumerations such as loops and object
   * keys retrievals, yet cannot be reconfigured or deleted. This provides a
   * balance between visibility and immutability. The symbol is generated or
   * retrieved based on a standardized JSON string, ensuring consistency
   * across different parts of the application.
   *
   * @returns {symbol} A Symbol for properties that are enumerable but not
   * configurable, making them visible in enumerations while preventing
   * modifications to their descriptors.
   */
  static get kImmutablyVisible() {
    return Symbol.for('{"enumerable":true,"configurable":false}')
  }

  /**
   * Applies a descriptor patch to an object instance, marking properties as
   * enumerable but not configurable. This method leverages the
   * `kImmutablyVisible` symbol to tag properties, ensuring they are visible
   * in property enumerations like loops and `Object.keys` retrievals, yet
   * remain immutable by preventing reconfiguration or deletion. This method
   * is particularly useful for making properties visible while maintaining
   * their immutability and preventing modifications.
   *
   * @param {object} instance The object instance to apply the patch to.
   * @param {object} [store=Object.create(null)] An optional store object to
   * hold patched
   * properties' original values and descriptors. If not provided, a new
   * object will be used to store this information.
   * @returns {object} The result of applying the descriptor patch, typically
   * a modified version of the `store` object containing the patched properties'
   * descriptors.
   */
  static immutablyVisible(instance, store = Object.create(null)) {
    return this.customDescriptorPatch(instance, this.kImmutablyVisible, store)
  }

  /**
   * Applies a custom descriptor patch to an object instance using a provided
   * symbol to tag the patched properties. This method also ensures the instance
   * is tracked for cleanup and stores the patch information in a WeakMap for
   * future reference or rollback. It's designed to work with property
   * descriptors that are either hidden or visible but immutable.
   *
   * @param {object} instance The object instance to which the patch is applied.
   * @param {symbol} symbol The symbol used to tag the patched properties,
   * indicating the nature of the patch (e.g., hidden or visible but immutable).
   * @param {object} [store=Object.create(null)] An optional object to store
   * the original property descriptors before the patch is applied. If not
   * provided, an empty object will be used.
   * @returns {object} The store object associated with the instance in the
   * WeakMap, containing the patched properties' descriptors.
   */
  static customDescriptorPatch(instance, symbol, store = Object.create(null)) {
    if (!this.stores.has(instance)) {
      this.stores.set(instance, store);

      if (Patch.isKnownPatchSymbol(symbol)) {
        store[symbol] = Object.create(null);
        return this.stores.get(instance)[symbol];
      }
    }

    return this.stores.get(instance);
  }

  /**
   * Determines if a given symbol is recognized as a patch symbol within the
   * system. Patch symbols are predefined symbols used to tag properties with
   * specific visibility and mutability characteristics. This method checks
   * if the provided symbol matches any of the known patch symbols.
   *
   * @param {symbol} maybeSymbol The symbol to check against known patch symbols.
   * @returns {boolean} True if the symbol is a known patch symbol, false otherwise.
   */
  static isKnownPatchSymbol(maybeSymbol) {
    if (typeof maybeSymbol === 'symbol') {
      return [
        this.kImmutablyHidden,
        this.kImmutablyVisible,
        this.kMutablyHidden,
        this.kMutablyVisible
      ].some(symbol => symbol === maybeSymbol)
    }

    return false
  }

  /**
   * Constructs an object or executes a function based on the `patchesOwner`
   * parameter, utilizing a custom descriptor patch. This method is intended
   * for advanced manipulation of object properties or function behaviors
   * through patching mechanisms defined by symbols. It applies a custom
   * descriptor patch to the `instance` using the provided `symbol` and
   * `store`, then either returns the `patchesOwner` directly if it's not a
   * function, or invokes it with the patched store.
   *
   * @param {Function|Object} patchesOwner The target function to be invoked
   * or the object to be returned directly. If a function, it is called with
   * the patched store.
   * @param {Object} instance The object instance to which the patch is applied.
   * @param {Symbol} symbol A symbol indicating the nature of the patch to be
   * applied, typically representing specific property behaviors.
   * @param {Object} [store=Object.create(null)] An optional object to store
   * the original property descriptors before the patch is applied. Defaults
   * to an empty object if not provided.
   * @returns {Function|Object} The result of calling `patchesOwner` with the
   * patched store if `patchesOwner` is a function, or `patchesOwner` itself
   * if it is not a function.
   */
  static constructWithStore(
    patchesOwner,
    instance,
    symbol = undefined,
    store = Object.create(null)
  ) {
    if (typeof patchesOwner !== 'function') {
      return patchesOwner;
    }

    try {
      const useStore = Patch.customDescriptorPatch(instance, symbol, store);
      return patchesOwner(useStore);
    }
    catch (ignored) {
      console.error(ignored);
      return patchesOwner;
    }
  }

  /**
   * Retrieves descriptor overrides from a symbol if it is recognized as a
   * known patch symbol. This method is crucial for dynamically adjusting
   * property descriptors based on predefined symbols, facilitating the
   * application of specific property behaviors (e.g., visibility, mutability)
   * without direct manipulation of the descriptors. It parses the symbol's
   * description, which is expected to be a JSON string representing the
   * descriptor overrides, and returns these overrides as an object.
   *
   * @param {symbol} symbol The symbol whose description contains JSON
   * stringified descriptor overrides.
   * @returns {object} An object representing the descriptor overrides if the
   * symbol is recognized; otherwise, an empty object.
   */
  static getDescriptorOverridesFromSymbol(symbol) {
    let overrides = Object.create(null)

    if (this.isKnownPatchSymbol(symbol)) {
      overrides = JSON.parse(symbol.description)
    }

    return overrides;
  }

  /**
   * A WeakMap to store patch information for object instances. This map
   * associates each patched object instance with its corresponding store
   * object, which contains the original property descriptors before the
   * patch was applied. The use of a WeakMap ensures that the memory used
   * to store this information can be reclaimed once the object instances
   * are no longer in use, preventing memory leaks.
   */
  static stores = new WeakMap();

  /**
   * Creates and returns an object that wraps a string with additional
   * properties and methods, making it more informative and useful for
   * debugging purposes. This method enhances a string by associating it
   * with a key-value pair and providing custom inspection functionality
   * for Node.js environments.
   *
   * @param {string} string The base string to be wrapped and enhanced.
   * @param {string} key The key associated with the string, accessible via the
   * `key` property of the returned object.
   * @param {any} value The value associated with the key, accessible via the
   * `value` property of the returned object.
   * @returns {object} An object that wraps the original string and includes
   * additional properties (`key`, `value`, `entry`, `entries`) and methods
   * (`valueOf`, custom inspection method for Node.js) for enhanced usability
   * and debugging.
   */
  static stringRef(string, key, value) {
    return Object.assign(Object(string), {
      get key() { return key },
      get value() { return value },
      get entry() { return [key, value] },
      get entries() { return [this.entry] },
      valueOf() { return String(this) },
      [Symbol.toStringTag]: 'String',
      [Symbol.for('nodejs.util.inspect.custom')](_, __, inspect) {
        return inspect(String(this), { colors: true })
      }
    });
  }

  /**
   * Checks if all own property names of an instance are also present as own
   * property names in a given prototype or the instance's constructor
   * prototype. This method is useful for determining if an instance shares
   * all its own property names with a prototype, which can be helpful in
   * various forms of type or structure validation.
   *
   * @param {object} instance The object instance whose own property names are
   * to be checked.
   * @param {object} [prototype] The prototype object to compare against. If not
   * provided, the method uses the instance's constructor prototype.
   * @returns {boolean} Returns true if all own property names of the instance
   * are also own property names in the given prototype or the instance's
   * constructor prototype. Otherwise, returns false.
   */
  static shareOwnPropertyNames(instance, prototype) {
    const ownPropNames = o => Object.getOwnPropertyNames(Object(o))

    return ownPropNames(instance).every(key =>
      ownPropNames(prototype ?? instance?.constructor?.prototype).
      some(innerKey => innerKey == key)
    )
  }


  /**
   * Extracts a descriptive name for a given object or function. This method
   * attempts to identify the most appropriate name based on the object's
   * characteristics or its constructor's name. If no specific name can be
   * determined, it falls back to a provided default name or generates a
   * unique identifier.
   *
   * The method first checks if the object is a non-function or an exception
   * like `Function.prototype`, and if it shares all the same own property
   * names as its constructor's prototype, it returns the constructor's name
   * with `.prototype` appended. If this check fails, it looks for a
   * `Symbol.toStringTag` property, then for a function's `name` property,
   * and then evaluates `defaultName` if it's a function or uses its string
   * value. If all these checks fail, it looks for known exceptions like
   * `Reflect` or generates a random string prefixed with `Unknown.`.
   *
   * @param {object|function} object The object or function to extract the
   * name from.
   * @param {string|function|undefined} defaultName A default name or a
   * function that returns a default name to use if no specific name can be
   * determined. @returns {string} The extracted name or the default/fallback
   * name.
   */
  static extractName(object, defaultName = undefined) {
    // Short-hand helper for Array.some(k => k === value)
    const oneOf = (a,type) => a.some(value => value === type)

    // Initially set valueOf to undefined
    let valueOf = undefined

    // Skipping known exceptions, check to see if the valueOf() exists
    if (!oneOf([Symbol.prototype, Date.prototype, BigInt.prototype], object)) {
      valueOf = object?.valueOf?.()
    }

    // Check to see if the result from valueOf() is a String
    let valueOfAsString = (
      (valueOf && (valueOf instanceof String || typeof valueOf === 'string'))
        ? String(valueOf)
        : undefined
    )

    return (
      // If its a symbol, use its String() value
      (typeof object === 'symbol' ? String(object) : undefined) ??
      (typeof object === 'string' ? object : undefined) ??
      (object instanceof String ? String(object) : undefined)
    ) || (
      // If we have a non-function (Function.prototype is the exception)
      // and we do have a constructor property, we share all the same
      // ownPropertyNames as the constructor's prototype (string instances
      // do not have the same props for example) then we can probably
      // assume we have a class/function prototype so return its name plus
      // .prototype
      (
        (object === Function.prototype || typeof object !== 'function') &&
        typeof object !== 'symbol'
      ) &&
      Patch.shareOwnPropertyNames(object) &&
      object?.constructor?.name &&
      `${object.constructor.name}.prototype`
    ) || (
      // Look for a Symbol.toStringTag first as this denotes a specified name
      object?.[Symbol.toStringTag] ??

      // Look for a function instance .name property next
      object?.name ??

      // Look for object.valueOf() and see if its a string
      valueOfAsString ??

      // If defaultName is a function, use its return value
      (typeof defaultName === 'function' ? defaultName(object) : undefined) ??

      // If defaultName is a string, use its value
      (typeof defaultName === 'string' ? defaultName : undefined) ??

      // Check for rare exceptions like Reflect (add more here as found)
      Object.entries({
        Reflect
      }).find(([_,v]) => v === object)?.[0] ??

      // Finally generate an Unknown.{randomString} value if nothing else works
      `Unknown.${Math.random().toString(36).slice(2)}`
    )
  }
}

/**
 * Custom inspection function for Node.js `util.inspect` that formats the
 * entries of the `Patch.patches` Map for improved readability in console
 * output. This function is specifically designed to be used as a custom
 * inspection function within Node.js environments, enhancing the debugging
 * experience by providing a clear, formatted view of the `Patch.patches`
 * Map's entries.
 *
 * @param {number} depth The depth to which the object should be formatted.
 * @param {object} options Formatting options provided by `util.inspect`.
 * @param {function} inspect The inspection function provided by Node.js
 * `util.inspect`, allowing for custom formatting of nested properties.
 * @returns {string} A formatted string representation of the `Patch.patches`
 * Map's entries, with each key-value pair on a new line and keys highlighted
 * for easy identification.
 */
Patch.patches[Symbol.for('nodejs.util.inspect.custom')] = function(
  depth,
  options,
  inspect
) {
  let parts = [
    'Patches [',
    ([...this.entries()]
      .map(([key, value]) => {
        const patches = (value
          .map(patch => `${' '.repeat(2)}${inspect(patch, options)}`)
          .toSorted()
          .join('\n')
        )

        return (
          `\x1b[22;1m${Patch.extractName(key)}\x1b[22m =>\n` +
          `${patches}\n`
        );
      })
      .toSorted()
      .join('\n')
    ),
    ']'
  ];

  if (parts[1].includes('\n')) {
    // Indent each line of the body by two spaces
    parts[1] = (parts[1]
      .split('\n')
      .map(line => `${' '.repeat(2)}${line}`)
      .join('\n')
    );

    // Join the output with new lines surrounding the body
    let output = parts.join('\n');
    return output.replace(/\n\s*\n]$/m, '\n]');
  }

  if (!parts[1]) {
    parts[1] = '\x1b[2;3mNo patches or extensions yet\x1b[22;23m'
  }

  return parts.join('');
}