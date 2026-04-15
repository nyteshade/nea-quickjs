/**
 * Represents a semantic version (semver) and provides utility methods for
 * managing and comparing versions according to the semver specification.
 */
export class SemVer {
  /**
   * Constructs a SemVer instance. Initializes the version based on the
   * provided semver string or defaults to "0.0.0" if not specified.
   *
   * Alternatively, if a specific portion of the version is indicated, only
   * that portion of the version instance will be modified. The `part` parameter
   * needs to match a portion of the SemVer object instance that needs updating;
   * `major`, `minor`, and `patch` are all converted to integers, while `prerelease`
   * and `metadata` are set as strings, unchanged.
   *
   * @param {string} [semverString="0.0.0"] - The initial semantic version string.
   * @param {string} [part="*"] - by default this is set to `*` which indicates that
   * the entire `semverString` is to be parsed. If the `part` is the name of a property
   * matching one of [`major`, `minor`, `patch`, `prerelease` or `metadata`] then
   * only that portion of the version is set. For major, minor and patch, the value
   * will be parsed into an integer. If an unknown key is specified, the entire
   * string will be processed.
   * @throws {Error} If semverString is not a valid semver format.
   */
  constructor(semverString = "0.0.0") {
    this.set(semverString)
  }

  /**
   * Sets the version based on a semver string. This method parses the string
   * and updates the major, minor, patch, prerelease, and metadata parts of the
   * version accordingly.
   *
   * @param {string} semverString - The semver string to parse and set.
   * @param {string} part - The part of the semver string to modify; this is one
   * of 'major', 'minor', 'patch', 'prerelease' and 'metadata'. If `SemVer.FULL`,
   * the default, is set, the entire string is parsed for values and all positions
   * will be updated.
   * @param {boolean} cascadeValues - if true, setting a new value for major or
   * minor that are higher than they were before will set minor and/or patch to
   * 0. So increasing a the MAJOR portion of 1.1.4, will cause the new version to
   * be 2.0.0. Likewise incrementing MINOR would cause that new value to be 1.2.0.
   * If this value is false, this additional value setting does not occur.
   * @returns {SemVer} returns `this` for chaining
   * @throws {Error} If semverString is not a string or not in valid semver format.
   */
  set(semverString, part = '*', cascadeValues = true) {
    const { MAJOR, MINOR, PATCH, PRERELEASE, METADATA, FULL } = SemVer

    if (part !== FULL) {
      const oldValue = this[part]
      const newValue = [MAJOR, MINOR, PATCH].includes(String(semverString).toLowerCase())
        ? parseInt(semverString)
        : semverString

      switch (part) {
        case MAJOR:
          this[part] = newValue
          if ((oldValue < newValue) && cascadeValues) {
            this[MINOR] = 0
            this[PATCH] = 0
          }
          return this

        case MINOR:
          this[part] = newValue
          if ((oldValue < newValue) && cascadeValues) {
            this[PATCH] = 0
          }
          return this

        case PATCH: this[part] = newValue; return this
        case PRERELEASE: this[part] = newValue; return this
        case METADATA: this[part] = newValue; return this
        default:
          break
      }
    }

    const [versionPart, prereleaseAndMetadata] = semverString.split('+');
    const [version, prerelease] = versionPart.split('-');
    const [major, minor, patch] = version.split('.').map(Number);

    if (version.split('.').length !== 3) {
      throw new Error('Version must be in the format major.minor.patch');
    }

    if ([major, minor, patch].some(num => num < 0 || isNaN(num))) {
      throw new Error('Major, minor, and patch versions must be non-negative integers');
    }

    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.prerelease = prerelease || '';
    this.metadata = prereleaseAndMetadata && prereleaseAndMetadata !== prerelease
      ? prereleaseAndMetadata
      : '';

    return this
  }

  /**
   * Retrieves the full version string in semver format. Constructs the version
   * string including the major, minor, patch versions, and optionally the
   * prerelease and metadata parts if they are present.
   *
   * @returns {string} The full version string in semver format.
   */
  get() {
    let semverString = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease) {
      semverString += `-${this.prerelease}`;
    }
    if (this.metadata) {
      semverString += `+${this.metadata}`;
    }
    return semverString;
  }

  /**
   * Increments part of the SemVer instance by the indicated amount.
   *
   * @param {string} version the portion of the version to increment. Valid values
   * are `major`, `minor` or `patch`.
   * @param {number} by - the amount by which the version is incremented. This
   * defaults to 1.
   * @returns {SemVer} the `this` instance for further chaining
   */
  increment(version, by = 1) {
    const { MAJOR, MINOR, PATCH } = SemVer

    if ([MAJOR, MINOR, PATCH].includes(version)) {
      this[version] = Math.round(this[version] + parseInt(by))

      if (version === MINOR || version === MAJOR) { this[PATCH] = 0 }
      if (version === MAJOR) { this[MINOR] = 0 }
    }

    return this
  }

  /**
   * Decrements part of the SemVer instance by the indicated amount.
   *
   * @param {string} version the portion of the version to decrement. Valid values
   * are `major`, `minor` or `patch`.
   * @param {number} by - the amount by which the version is decremented. This
   * defaults to 1.
   * @returns {SemVer} the `this` instance for further chaining
   */
  decrement(version, by = 1) {
    const { MAJOR, MINOR, PATCH } = SemVer

    if ([MAJOR, MINOR, PATCH].includes(version)) {
      const newValue = Math.round(this[version] - parseInt(by))

      this[version] = Math.max(0, newValue)
    }

    return this
  }

  /**
   * Returns a string representation of the SemVer instance.
   *
   * This method is an alias for the `get()` method, which returns the
   * full semver string including the major, minor, patch, prerelease,
   * and metadata components.
   *
   * @returns {string} The string representation of the SemVer instance.
   *
   * @example
   * const version = new SemVer('1.2.3-beta.1+build.123')
   * console.log(version.toString())
   * // Output: '1.2.3-beta.1+build.123'
   */
  toString() {
    return this.get()
  }

  /**
   * Converts the version to a primitive value based on the context. When
   * converting to a number, only the major and minor parts are considered.
   * When converting to a string, the full semver string is returned.
   *
   * @param {string} hint - The context in which conversion is requested ("number"
   * or "string").
   * @returns {(string|number|null)} The converted value.
   */
  [Symbol.toPrimitive](hint) {
    switch (hint) {
      case 'number':
        return parseFloat(`${this.major}.${this.minor}`);
      case 'string':
        return this.get();
      default:
        return null;
    }
  }

  /**
   * Determines if this version is exactly equal to another version. This
   * comparison includes the major, minor, patch, prerelease, and metadata
   * parts of the version. It's a strict comparison where all parts must match.
   *
   * @param {SemVer} otherVersion - The other SemVer instance to compare with.
   * @returns {boolean} True if all version components are exactly equal.
   */
  isEqual(otherVersion) {
    return this.major === otherVersion.major &&
           this.minor === otherVersion.minor &&
           this.patch === otherVersion.patch &&
           this.prerelease === otherVersion.prerelease &&
           this.metadata === otherVersion.metadata;
  }

  /**
   * Checks if this version is equal to another version based only on the major,
   * minor, and patch numbers. This method ignores the prerelease and metadata
   * parts of the version, making it a "loose" or "lenient" comparison. It is
   * useful for determining compatibility or disregarding build and pre-release
   * details.
   *
   * @param {SemVer} otherVersion - The other SemVer instance to compare with.
   * @returns {boolean} True if major, minor, and patch numbers are equal.
   */
  isLooselyEqual(otherVersion) {
    return this.major === otherVersion.major &&
           this.minor === otherVersion.minor &&
           this.patch === otherVersion.patch;
  }

  /**
   * Compares this version to another version according to semver equality
   * rules. In semver, two versions are considered equal if they have the same
   * major, minor, and patch numbers. This method also considers prerelease
   * tags but ignores build metadata. For example, "1.0.0-alpha" and
   * "1.0.0-alpha+build" are considered equal.
   *
   * @param {SemVer} otherVersion - The other SemVer instance to compare with.
   * @returns {boolean} True if versions are considered equal in semver terms.
   */
  isSemverEqual(otherVersion) {
    return this.major === otherVersion.major &&
           this.minor === otherVersion.minor &&
           this.patch === otherVersion.patch &&
           this.prerelease === otherVersion.prerelease;
  }

  /**
   * Provides a custom tag when the object is converted to a string. This
   * method overrides the default behavior to return the class name instead
   * of the generic "Object" tag.
   *
   * @returns {string} The class name "SemVer".
   */
  get [Symbol.toStringTag]() {
    return this.constructor.name
  }

  /**
   * The primary version number for this SemVer instance. This version of the
   * instance, when bumped, indicates likely breaking changes or at least a
   * semmantic separation from previous major revisions
   *
   * @type {number}
   */
  major = 0

  /**
   * The minor version number for this SemVer instance. This version of the instance,
   * when bumped, usually indicates that new features are present. It is expected,
   * however, that minor bump versions are backwards compatible.
   *
   * @type {number}
   */
  minor = 0

  /**
   * The patch version number for this SemVer instance. This version of the instance,
   * when bumped, usually indicates that some fix has been applied but that there are
   * no new features or breaking changes. These should usually be taken greedily.
   */
  patch = 0

  /**
   * This is prerelease string indicator. Usually this has a value like "alpha" or
   * "beta". A SemVer value with a prerelease indicator might look like "1.0.0-beta"
   * indicating, in this example, that it is a beta release for 1.0.0.
   *
   * @type {string}
   */
  prerelease = ''

  /**
   * The metadata string portion of a SemVer version is a note to the consumer but
   * may not have any real bearing on changes. This is a human readable version. A
   * metadata portion may show up in a SemVer string as "1.0.0-beta+001". In this
   * case maybe providing an iteration value. It can be any string. It is only usually
   * compared in version comparisons, in the strictest compares.
   *
   * @type {string}
   */
  metadata = ''

  /**
   * Creates a SemVer instance from a substring containing a semantic
   * version string.
   *
   * @param {string} fromSubstring - The string to extract a semantic
   *   version from.
   * @returns {object|undefined} An object containing the matched
   *   `SemVer` instance and the range of the match, or `undefined` if
   *   no match is found.
   * @example
   * const result = SemVer.from('This is version 1.2.3-beta.1+build.123')
   * if (result) {
   *   console.log(result.semVer.get()) // '1.2.3-beta.1+build.123'
   *   console.log(result.range) // [16, 37]
   * }
   */
  static from(fromSubstring) {
    const match = this.match(fromSubstring)

    if (match.semVer) {
      return { semVer: match.semVer, range: match.range }
    }

    return undefined
  }

  /**
   * Matches a semantic version string within a larger string.
   *
   * @param {string} asSubstringOf - The string to search for a
   *   semantic version within.
   * @returns {object} An object containing the matched semantic
   *   version string, a `SemVer` instance, the range of the match,
   *   the parsed regex result, and `toString` and `Symbol.iterator`
   *   methods.
   * @example
   * const result = SemVer.match('This is version 1.2.3-beta.1+build.123')
   * console.log(result.semVerString) // '1.2.3-beta.1+build.123'
   * console.log(result.semVer.get()) // '1.2.3-beta.1+build.123'
   * console.log(result.range) // [16, 37]
   * console.log([...result])  // ['1', '.', '2', '.', '3', ...]
   */
  static match(asSubstringOf) {
    let semVerString
    let semVer
    let parts = []

    const r = SemVer.kSemVerPattern.exec(asSubstringOf)
    if (r) {
      parts = parts.concat(r.slice(1, 4)).filter(p => p)
      parts = [parts.join('.')]

      if (r[4]) {
        parts.push(`-${r[4]}`)
      }

      if (r[5]) {
        parts.push(`+${r[5]}`)
      }
    }

    if (parts.length) {
      semVerString = parts.join('')
      semVer = new SemVer(semVerString)
    }

    return {
      semVerString,
      semVer,
      range: [r.index, r.index + r[0].length],
      regexParsed: r,
      toString() { return this.semVer },
      *[Symbol.iterator]() {
        return this?.semVer[Symbol.iterator]
      }
    }
  }

  /**
   * The `kSemVerPattern` is a regular expression that matches semantic
   * version strings. It captures the major, minor, and patch version
   * numbers, as well as optional prerelease and build metadata.
   *
   * @example
   * const version = '1.2.3-beta.1+build.123'
   * const match = version.match(SemVer.kSemVerPattern)
   * console.log(match)
   * // Output:
   * // [
   * //   '1.2.3-beta.1+build.123',
   * //   '1',
   * //   '2',
   * //   '3',
   * //   'beta.1',
   * //   'build.123'
   * // ]
   *
   * @type {RegExp}
   */
  static get kSemVerPattern() {
    return /\b(\d+)\.?(\d+)?\.?(\d+)?\-?([\w\d]+)?\+?([\w\d]+)?\b/
  }

  /**
   * The `FULL` constant can be passed as a second parameter, inspite of it being
   * the default value, to the `.set()` method on `SemVer` instances. It indicates
   * that the full SemVer string should be parsed and set.
   *
   * @type {string}
   */
  static get FULL() { return "*" }

  /**
   * The `MAJOR` constant can be used as a parameter to `set()`, `increment()`,
   * and `decrement()` methods. It points to the major semver version number.
   *
   * @example semver.increment(SemVer.MAJOR).get()
   *
   * @type {string}
   */
  static get MAJOR() { return "major" }

  /**
   * The `MINOR` constant can be used as a parameter to `set()`, `increment()`,
   * and `decrement()` methods. It points to the minor semver version number.
   *
   * @example semver.increment(SemVer.MINOR).get()
   *
   * @type {string}
   */
  static get MINOR() { return "minor" }

  /**
   * The `PATCH` constant can be used as a parameter to `set()`, `increment()`,
   * and `decrement()` methods. It points to the patch semver version number.
   *
   * @example semver.increment(SemVer.PATCH).get()
   *
   * @type {string}
   */
  static get PATCH() { return "patch" }

  /**
   * The `PRERELEASE` constant can be used as a parameter to `set()` method. It
   * points to the pre-release semver version text.
   *
   * @example semver.set("beta", SemVer.PRERELEASE).get()
   *
   * @type {string}
   */
  static get PRERELEASE() { return "prerelease" }

  /**
   * The `METADATA` constant can be used as a parameter to `set()` method. It
   * points to the metadata semver version text.
   *
   * @example semver.set("bries_release", SemVer.METADATA).get()
   *
   * @type {string}
   */
  static get METADATA() { return "metadata" }

  /**
   * Compares two semver strings for semver equality. This static method allows
   * for a direct comparison without needing to create SemVer instances
   * externally. It is useful for quick comparisons where instantiation of
   * objects is not necessary.
   *
   * @param {string} leftVersion - The first version string to compare.
   * @param {string} rightVersion - The second version string to compare.
   * @returns {boolean} True if the versions are semver equal according to
   * the isSemverEqual method.
   */
  static compare(leftVersion, rightVersion) {
    return new SemVer(leftVersion).isSemverEqual(new SemVer(rightVersion))
  }
}

export default SemVer