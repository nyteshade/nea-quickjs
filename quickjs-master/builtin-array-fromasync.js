;(function(Array, TypeError, Symbol·asyncIterator, Object·defineProperty, Symbol·iterator) {
    "use strict" // result.length=i should throw if .length is not writable
    // Array.fromAsync as the proposal specifies it. What upstream did
    // differently, each of which a script could observe:
    //  - the iterator was closed in a 'finally': return() ran after a
    //    normal end and after next() itself had failed, and what it
    //    returned was never awaited;
    //  - the elements were not enumerable (Object.keys() was empty);
    //  - the iterator was fetched before the result was constructed,
    //    and next was read again for every element.
    // After editing, regenerate builtin-array-fromasync.h with the
    // qjsc built from these sources (see "codegen" in the Makefile).
    return async function fromAsync(arrayLike, mapFn=undefined, thisArg=undefined) {
        if (mapFn !== undefined && typeof mapFn !== "function") throw new TypeError("not a function")
        let result, i = 0, isConstructor = typeof this === "function"
        let sync = false, method = arrayLike[Symbol·asyncIterator]
        if (method == null) sync = true, method = arrayLike[Symbol·iterator]
        if (method == null) {
            let {length} = arrayLike
            length = +length || 0
            result = isConstructor ? new this(length) : Array(length)
            while (i < length) {
                let value = await arrayLike[i]
                if (mapFn) value = await mapFn.call(thisArg, value, i)
                Object·defineProperty(result, i++, {value, configurable: true, writable: true, enumerable: true})
            }
        } else {
            result = isConstructor ? new this() : Array()
            const iter = method.call(arrayLike)
            if (iter === null || (typeof iter !== "object" && typeof iter !== "function"))
                throw new TypeError("not an object")
            const next = iter.next
            for (;;) {
                // a failure in here is the iterator's own: it is not closed
                const step = await next.call(iter)
                if (step === null || (typeof step !== "object" && typeof step !== "function"))
                    throw new TypeError("iterator result is not an object")
                if (step.done) break
                let value = step.value
                try {
                    if (sync) value = await value
                    if (mapFn) value = await mapFn.call(thisArg, value, i)
                    Object·defineProperty(result, i++, {value, configurable: true, writable: true, enumerable: true})
                } catch (e) {
                    // close the iterator, wait for it, and let the
                    // first error win over whatever closing throws
                    try {
                        const close = iter.return
                        if (close != null) await close.call(iter)
                    } catch (_) {
                    }
                    throw e
                }
            }
        }
        result.length = i
        return result
    }
})
