/* quickjs-master/amiga/ffi/boopsi/NodeList.js
 *
 * Builds the exec list of nodes that a Reaction gadget takes for its
 * labels: CHOOSER_Labels, CLICKTAB_Labels, RADIOBUTTON_Labels,
 * LISTBROWSER_Labels, SPEEDBAR_Buttons.
 *
 * All five work the same way. The gadget's class library has an
 * AllocXxxNodeA(tags) function that returns a struct Node with the
 * class's private data behind it, and a FreeXxxNode(node). The
 * application links the nodes into a struct List of its own and gives
 * the gadget a pointer to it. The gadget does not copy anything: the
 * list, the nodes and (unless the class says otherwise) the strings
 * the nodes point at must stay until the gadget is disposed, and are
 * then freed by the application, nodes first.
 *
 * Until 0.231 each of the five wrappers had its own copy of this,
 * with the list offsets typed in.
 */

import { ExecList } from '../structs/ExecList.js';

/**
 * What describe() is handed to keep things alive as long as the list.
 *
 * @typedef {object} NodeListKeeper
 * @property {function(string): number} string - copy a string into
 *   memory that lives until freeAll(); returns the C string pointer
 * @property {function(function(): undefined): undefined} afterNodes -
 *   register something to run in freeAll() once the nodes are freed
 *   (to dispose an image a node pointed at, say)
 */

/**
 * Build a list of class-allocated nodes.
 *
 * @param {object} spec
 * @param {string} spec.owner - the wrapper's name, for error messages
 * @param {number} spec.libBase - the class library's base
 * @param {number} spec.allocLvo - offset of its AllocXxxNodeA
 * @param {number} spec.freeLvo - offset of its FreeXxxNode
 * @param {number} spec.count - how many nodes to make
 * @param {function(number, NodeListKeeper): {pairs: Array<[number, number]>, d0: (number|undefined)}} spec.describe -
 *   called once per node with its index; returns the node's tag pairs
 *   and, for an allocator that takes a number in d0 (a column count or
 *   an ordinal), that number
 * @returns {{listPtr: number, freeAll: function(): undefined}} the
 *   struct List pointer to give the gadget, and the function that
 *   frees the nodes, the strings and the list: call it after the
 *   gadget is disposed, never before
 * @throws {Error} if a node cannot be allocated; nothing is leaked
 */
export function buildNodeList(spec) {
  const amiga = globalThis.amiga;
  const list  = new ExecList();

  /** @type {number[]} node pointers, in list order */
  const nodes = [];
  /** @type {Array<{free: function(): undefined}>} amiga.allocString holders */
  const strings = [];
  /** @type {Array<function(): undefined>} */
  const afterNodes = [];

  let freed = false;

  /**
   * Free the nodes, then what they pointed at, then the list header.
   * Each step is attempted even if an earlier one throws. Safe to
   * call twice.
   *
   * @returns {undefined}
   */
  function freeAll() {
    if (freed) return;
    freed = true;

    for (const node of nodes) {
      try { amiga.call(spec.libBase, spec.freeLvo, { a0: node }); }
      catch (_) { /* keep going: the rest must still be freed */ }
    }

    for (const callback of afterNodes) {
      try { callback(); } catch (_) { /* as above */ }
    }

    for (const holder of strings) {
      try { holder.free(); } catch (_) { /* as above */ }
    }

    list.free();
  }

  /** @type {NodeListKeeper} */
  const keep = {
    string(text) {
      const holder = amiga.allocString(text);

      strings.push(holder);
      return holder.ptr;
    },

    afterNodes(callback) {
      afterNodes.push(callback);
    },
  };

  try {
    for (let index = 0; index < spec.count; index++) {
      const described = spec.describe(index, keep);
      const regs = { a0: 0 };

      if (described.d0 !== undefined) {
        regs.d0 = described.d0;
      }

      const node = amiga.withTags(described.pairs, (tags) => {
        regs.a0 = tags;
        return amiga.call(spec.libBase, spec.allocLvo, regs);
      });

      if (!node) {
        throw new Error(spec.owner + ': could not allocate node ' + index);
      }

      nodes.push(node);
      list.addTail(node);
    }
  }
  catch (error) {
    freeAll();
    throw error;
  }

  return { listPtr: list.ptr, freeAll };
}
