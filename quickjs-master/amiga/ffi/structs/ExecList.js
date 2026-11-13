/* quickjs-master/amiga/ffi/structs/ExecList.js
 *
 * struct List (exec/lists.h): the header of an exec doubly linked
 * list. This is the one place the wrappers build or walk such a list;
 * until 0.231 five Reaction gadgets each did it with their own copy of
 * the offsets.
 *
 * How an exec list works: the header holds two overlapping sentinel
 * nodes. lh_Head points at the first real node, or at &lh_Tail when
 * the list is empty; lh_Tail is always NULL; lh_TailPred points at the
 * last real node, or at &lh_Head when the list is empty. A node is the
 * last one when its ln_Succ points at &lh_Tail.
 *
 * Named ExecList rather than List so that the name says which kind of
 * list it is. Scripts reach it as amiga.exec.List; it is not a global.
 */

import { Struct } from './Struct.js';
import { ExecNode } from './ExecNode.js';

export class ExecList extends Struct {
  /* check-structs: struct List */
  /**
   * Byte offsets of the fields this wrapper touches, named as in
   * exec/lists.h. Checked against the compiler's own layout of the
   * struct by scripts/check_structs.py.
   *
   * @type {Object<string, number>}
   */
  static OFFSET = Object.freeze({
    lh_Head:     0,
    lh_Tail:     4,
    lh_TailPred: 8,
    lh_Type:     12,
  });

  /** @type {number} */
  static SIZE = 14;

  /**
   * @param {number} [ptr] - an existing struct List to wrap. Omit to
   *   allocate a new one, which starts out empty (as after NewList())
   *   and must be free()d once nothing uses it any more.
   */
  constructor(ptr) {
    super(ptr);

    if (ptr === undefined) {
      this.clear();
    }
  }

  /**
   * Make the list empty, as the NewList() macro does. The nodes that
   * were on it are not touched or freed.
   *
   * @returns {undefined}
   */
  clear() {
    this.write32(ExecList.OFFSET.lh_Head, this.ptr + ExecList.OFFSET.lh_Tail);
    this.write32(ExecList.OFFSET.lh_Tail, 0);
    this.write32(ExecList.OFFSET.lh_TailPred,
                 this.ptr + ExecList.OFFSET.lh_Head);
  }

  /** @returns {boolean} whether the list has no nodes */
  get isEmpty() {
    return (this.read32(ExecList.OFFSET.lh_TailPred) >>> 0) ===
           ((this.ptr + ExecList.OFFSET.lh_Head) >>> 0);
  }

  /**
   * Add a node at the end, as exec's AddTail() does.
   *
   * @param {number|ExecNode} node - the node, or a pointer to it
   * @returns {undefined}
   */
  addTail(node) {
    let added = (node instanceof ExecNode) ? node : new ExecNode(node);
    let last  = new ExecNode(this.read32(ExecList.OFFSET.lh_TailPred));

    added.succ = this.ptr + ExecList.OFFSET.lh_Tail;
    added.pred = last.ptr;
    /* When the list is empty `last` is the header itself, whose
     * lh_Head lies where a node's ln_Succ does. */
    last.succ  = added.ptr;
    this.write32(ExecList.OFFSET.lh_TailPred, added.ptr);
  }

  /**
   * The nodes, first to last.
   *
   * @returns {Generator<number>} each node's pointer
   */
  *nodes() {
    let node = new ExecNode(this.read32(ExecList.OFFSET.lh_Head));

    for (;;) {
      let next = node.succ;

      if (!next) return;          /* reached lh_Tail, which is NULL */

      yield node.ptr >>> 0;
      node = new ExecNode(next);
    }
  }
}
