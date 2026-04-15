# @nejs/enumeration

A zero-dependency ESM library that brings Swift-style runtime enumerations to JavaScript. Unlike TypeScript's `enum`, which only exists at compile time, `Enumeration` instances are real objects you can pass around, extend with methods, pattern-match against, and attach per-instance associated values to.

**[API Documentation](https://nyteshade.github.io/ne-enumeration/)**

## Installation

```sh
npm install @nejs/enumeration
```

## Browser / CDN

Use the library directly in a browser via jsDelivr — no build step required:

```html
<script type="module">
  import Enumeration from 'https://cdn.jsdelivr.net/npm/@nejs/enumeration/src/enumeration.mjs'
</script>
```

To pin to a specific version, include it in the URL:

```html
<script type="module">
  import Enumeration from 'https://cdn.jsdelivr.net/npm/@nejs/enumeration@1.0.0/src/enumeration.mjs'
</script>
```

## Quick Start

```js
import Enumeration from '@nejs/enumeration'

class Direction extends Enumeration {
  static {
    Direction.define('north')
    Direction.define('south')
    Direction.define('east')
    Direction.define('west')
  }
}

console.log(Direction.north.key)   // 'north'
console.log(Direction.north.value) // 'north'  (defaults to key when no value given)
console.log(`${Direction.north}`)  // 'north'  (toString returns key)
console.log(Direction.north.case)  // 'Direction.north'
```

## Defining Cases

`ClassName.define(key, value?, customizeInstance?)` registers a static getter on the class for each case. The call must live inside a `static {}` initializer block.

```js
class Status extends Enumeration {
  static {
    Status.define('ok',    200)
    Status.define('notFound', 404)
    Status.define('error', 500)
  }
}

Status.ok.key    // 'ok'
Status.ok.value  // 200
+Status.ok       // 200  (valueOf returns .value; numeric coercion uses .value if it is a number)
```

### Object values and the SubscriptProxy

When a case's value is an object, its properties are accessible directly on the enum instance via the built-in `SubscriptProxy`:

```js
class Color extends Enumeration {
  static {
    Color.define('red',   { r: 255, g: 0,   b: 0,   a: 255 })
    Color.define('green', { r: 0,   g: 255, b: 0,   a: 255 })
    Color.define('blue',  { r: 0,   g: 0,   b: 255, a: 255 })
  }
}

Color.red.value.r  // 255 — via .value
Color.red.r        // 255 — via SubscriptProxy shorthand
const { r, g, b, a } = Color.red  // destructuring works too
```

The proxy lookup order for a missing property is:
1. `this.associations[property]` (if associated values are present)
2. `this.value[property]` (if `.value` is an object)
3. Normal prototype chain

### Customizing instances

`define()` accepts an optional third argument to customize the new case instance. Pass an object with property descriptors (getters, setters, etc.) or a function `(instance) => instance`:

```js
class Color extends Enumeration {
  static {
    // Custom getter that redirects .value to .associations
    Color.define('rgb', null, {
      get value() { return this.associations ?? { r: 0, g: 0, b: 0, a: 255 } }
    })
  }
}
```

## Associated Values

`associate(...entries)` creates a variant copy of an enum case with per-instance data attached — modeled after Swift's enums with associated values. The original static case is never mutated.

```js
const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })

chestnut.key              // 'rgb'  — still the same case type
chestnut instanceof Color // true
chestnut.hasAssociatedValues // true
chestnut.r                // 200   — via SubscriptProxy -> associations
chestnut.associations     // { r: 200, g: 76, b: 49, a: 255 }
chestnut.associated('r')  // 200   — explicit lookup, safe when property names collide
```

`associate()` accepts entries in three forms, and multiple entries can be passed:

```js
// Object — key/value pairs merged in
instance.associate({ r: 255, g: 0, b: 0 })

// Object entry (2-element array)
instance.associate(['r', 255])

// Bare key — value equals the key itself
instance.associate('label')  // associations.label === 'label'
```

If the instance already has associated values, `associate()` merges into the existing associations and returns `this` instead of creating a new copy.

## Adding Methods

Because each enum case is a real instance of the class, instance methods live on the prototype and work across all cases:

```js
class Color extends Enumeration {
  toHex(includeAlpha = false) {
    const { r, g, b, a } = this
    const base = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
    return includeAlpha ? base + a.toString(16) : base
  }

  static {
    Color.define('red',   { r: 255, g: 0, b: 0, a: 255 })
    Color.define('green', { r: 0, g: 255, b: 0, a: 255 })
  }
}

Color.red.toHex()         // '#ff0000'

const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
chestnut.toHex()          // '#c84c31'
```

## Pattern Matching

### `ClassName.match(instance, present?, missing?)`

Synchronous pattern match. Checks whether `instance` is a known case of the enum, then calls (or returns) `present` or `missing`:

```js
// Boolean shorthand
Color.match(Color.red)         // true
Color.match(null)              // false
Color.match('anything')        // false

// third arg is .value when it is an object and there are no associations
Color.match(Color.red, (_, __, { r }) => r)        // 255

// third arg is .associations when the instance has associated values
const chestnut = Color.rgb.associate({ r: 200, g: 76, b: 49, a: 255 })
Color.match(chestnut, (_, __, { r }) => r)         // 200

// third arg is {} when value is not an object and there are no associations
// Direction.north.value === 'north' (a string)
Direction.match(Direction.north, (_, __, obj) => obj)  // {}

// With plain values instead of functions
Color.match(null, 'found', 'not found')            // 'not found'

// missing handler receives the original instance
Color.match(null, (_, __, { r }) => r, () => 0)    // 0

// instance methods are usable directly in the handler
Color.match(chestnut, c => c.toHex())              // '#c84c31'
```

The `present` callback signature: `(instance, baseCase, associations) => any`
- `instance` — the value passed in (may have custom associated values)
- `baseCase` — the matched static case (no associated values)
- `associations` — resolved in priority order: `instance.associations` if set, then `instance.value` if it is an object, otherwise `{}`

The `missing` callback signature: `(instance) => any`

### `ClassName.asyncMatch(instance, present?, missing?)`

Identical API, but both callbacks may be `async` and the result is always a `Promise`.

### `instance.is(someCase)` / `ClassName.is(left, right)`

Loose equality check on `.key` values:

```js
Color.red.is(Color.red)                  // true
Color.is(chestnut, Color.rgb)            // true  (same key, different associations)
```

## Iterating Cases

```js
// All [key, value] pairs
for (const [key, value] of Color) { ... }

// Just keys
for (const key of Color.cases()) { ... }

// Just values (Enumeration instances)
for (const value of Color.values()) { ... }

// Array helpers
[...Color.cases()]   // ['red', 'green', 'blue', 'rgb']
[...Color.values()]  // [Color.red, Color.green, Color.blue, Color.rgb]

// .case getter for fully-qualified name
[...Color.values()].map(c => c.case)
// ['Color.red', 'Color.green', 'Color.blue', 'Color.rgb']
```

`Symbol.iterator` only yields entries whose values are `instanceof` the class, so inherited static properties from `Enumeration` itself are excluded.

## Coercion and Serialization

| Operation | Result |
|---|---|
| `String(Color.red)` | `'red'` (key) |
| `` `${Color.red}` `` | `'red'` (key) |
| `Color.red.valueOf()` | `{ r: 255, g: 0, b: 0, a: 255 }` (value) |
| `+Status.ok` | `200` (numeric hint returns `.value` when it is a number) |
| `Object.prototype.toString.call(Color.red)` | `'[object Color]'` (`Symbol.toStringTag`) |

## API Reference

### `Enumeration` instance properties

| Property | Type | Description |
|---|---|---|
| `.key` | `string \| number \| symbol` | Case name |
| `.value` | `any` | Case value; defaults to `.key` if not supplied |
| `.associations` | `object \| null` | Per-instance associated data; `null` unless `.associate()` was called |
| `.hasAssociatedValues` | `boolean` | `true` when `.associations !== null` |
| `.case` | `string` | `'ClassName.key'` |

### `Enumeration` instance methods

| Method | Returns | Description |
|---|---|---|
| `.associate(...entries)` | `this \| new instance` | Attach associated values |
| `.associated(key)` | `any \| null` | Read one associated value by key |
| `.is(someCase)` | `boolean` | Loose key equality check |
| `.toString()` | `string` | `String(this.key)` |
| `.valueOf()` | `any` | `this.value` |

### `Enumeration` static methods

| Method | Description |
|---|---|
| `define(key, value?, customizeInstance?)` | Register a new enum case |
| `match(instance, present?, missing?)` | Synchronous pattern match |
| `asyncMatch(instance, present?, missing?)` | Async pattern match |
| `is(left, right)` | Loose key equality check |
| `*[Symbol.iterator]()` | Yields `[key, value]` pairs |
| `*cases()` | Yields case keys |
| `*values()` | Yields case instances |

## License

MIT
