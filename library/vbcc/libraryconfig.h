/*
 * libraryconfig.h — Configuration for quickjs.library via VBCC template
 *
 * This file is included by library.h from the vbcc-librarytemplate.
 * It defines the library base structure, version info, and function table.
 */
#ifndef LIBRARYCONFIG_H
#define LIBRARYCONFIG_H

#include <exec/types.h>
#include <exec/libraries.h>
#include <exec/execbase.h>
#include <dos/dos.h>
#include "execinline.h"

/* Forward declarations for QuickJS types */
struct JSRuntime;
struct JSContext;
typedef union { long int32; double float64; void *ptr; long sbi; } JSValueUnion;
typedef struct { JSValueUnion u; long tag; } JSValue;

/* ---- Library base structure ---- */

struct QJSLibBase {
    struct Library iLibrary;
    UWORD iPadding;
    BPTR iSegmentList;
    struct ExecBase *iSysBase;
    /* Custom fields — all opened/created in CustomLibInit */
    struct Library *iDOSBase;
    struct Library *iMathDoubBasBase;
    struct Library *iMathDoubTransBase;
    APTR iMemPool;              /* exec memory pool for allocations */
    ULONG iNetCaps;             /* W7: bitmask of QJS_NET_* probed at init */
};

/* Networking capability bits — set by CustomLibInit via probe of
 * bsdsocket.library (v4) and amisslmaster.library. Queryable via
 * QJS_GetNetCapabilities LVO and from JS via the "qjs:net" module.
 * fetch() checks these before attempting a request and throws a
 * clear TypeError naming the missing library when a cap is absent. */
#define QJS_NET_TCP  0x01
#define QJS_NET_TLS  0x02

/* ---- Steering defines ---- */

#define LIBRARY_NAME "quickjs.library"

/* QJS_VARIANT_NAME is injected by the Makefile per CPU/FPU variant
 * as an UNQUOTED token: 020fpu, 020soft, 040fpu, 040soft, 060fpu, 060soft.
 * QJS_STR() stringifies it (two-level macro is required for token
 * concatenation → string literal conversion to work with passed-in defines).
 *
 * Appears in the $VER string so each library instance is self-identifying
 * even after being copied to LIBS:quickjs.library (where the filename
 * no longer carries the variant info). */
#ifndef QJS_VARIANT_NAME
#define QJS_VARIANT_NAME unknown
#endif
#define _QJS_STR(x) #x
#define QJS_STR(x) _QJS_STR(x)

/* ===== Packed-decimal versioning =====
 *
 * AmigaOS's lib_Version field is a single UWORD checked by OpenLibrary's
 * gate. A naive split (major in lib_Version, minor in lib_Revision) has
 * two failure modes: (1) minor bumps don't evict resident old copies
 * (lib_Version stays the same), and (2) bumping to "1.0" culturally
 * signals a release we haven't earned yet.
 *
 * Solution: lib_Version holds a PACKED decimal number  M*1000 + R, where
 *   M = major digit (0..65)    — pre-release while 0, released when ≥1
 *   R = revision   (000..999)  — monotonic within a major; always displayed
 *                                as three digits (leading zeros preserved)
 *
 * Examples:
 *   lib_Version = 70   → displays "0.070"  — pre-release, has Worker API
 *   lib_Version = 120  → displays "0.120"  — future dev state
 *   lib_Version = 1000 → displays "1.000"  — first real release
 *   lib_Version = 1005 → displays "1.005"  — first post-release bugfix
 *   lib_Version = 1050 → displays "1.050"  — NOT "1.05"; always 3-digit rev
 *
 * Properties:
 *   - Integer monotonic: OpenLibrary's version check and exec's resident
 *     eviction both work correctly — any newer version is strictly greater.
 *   - No cultural overclaim: we stay under 1000 until genuinely releasing
 *     v1. The $VER string matches the packed encoding.
 *   - Consumer API gate: OpenLibrary("quickjs.library", 70) means "I need
 *     at least the 0.070 API (which has Worker LVOs)". When we add a new
 *     capability (e.g. child_process at packed 200), consumers who need
 *     that pass 200.
 *
 * Bump rules:
 *   - Any bugfix, feature, LVO addition → lib_Version += 1
 *   - Cutting a real v1 release         → lib_Version jumps to 1000
 *   - v1 post-release patches           → 1001, 1002, ...
 *   - Next major (v2)                   → 2000
 *
 * lib_Revision (the Library struct field) is redundant with the packed
 * encoding; we mirror the revision part there purely for anything that
 * naively prints "lib_Version.lib_Revision" (not much does on AmigaOS —
 * the 'version' command reads $VER).
 *
 * Worker API milestone is lib_Version = 70 ("0.070").
 */
#define LIBRARY_VERSION_STRING \
    "\0$VER: quickjs." QJS_STR(QJS_VARIANT_NAME) ".library 0.169 (24.4.2026)\r\n"
#define LIBRARY_VERSION_OUTPUT &LIBRARY_VERSION_STRING[7]
#define LIBRARY_VERSION   169  /* packed: major=0, revision=169. Window.events({extraSignals}) — non-Intuition signal integration. Window.events() now accepts an options object with `extraSignals: uint32` that merges into the Exec.Wait mask alongside WINDOW_SigMask. When any of those bits fire, the generator yields a synthetic EventKind.SIGNAL event whose attrs.sigMask carries the bits that actually fired (masked to the requested extras; the window signal never surfaces as a SIGNAL event). EventKind.SIGNAL defined with from:'exec' so it stays out of fromIdcmp lookup (which only walks IDCMP-from:'intuition' cases). Canonical hook for integrating timer.device, AllocSignal bits, or other msgport signals into the same synchronous event loop — no separate polling thread, no IDCMP_INTUITICKS 10Hz dependency. New demo: amiga/examples/reaction_clock_demo.js — a 1Hz live clock on top of the Reaction OO layer (readonly StringGadget display + Quit button) that uses timer.device UNIT_VBLANK with SendIO/AbortIO/WaitIO and passes its reply-port sigMask to Window.events({extraSignals}). Answers the baton open question "setTimeout + win.events() integration — probe this session exposed timers don't fire while blocked in Wait(windowSigMask). Merge timer signal into Wait mask. Needed for stopwatch/clock." NOTE: does NOT touch global os.setTimeout. True setTimeout-fires-during-Wait integration would require a native LVO to "run any due JS timers now" — deferred; the current primitive is generic enough that a user can manage their own timer state. AWAITING AMIGA TEST — nothing else changed; existing demos should behave identically (no-arg events() path unaffected). */  /* packed: major=0, revision=168. Reaction Phase E prep — AllocXXXNode helpers for Chooser / ClickTab / ListBrowser / SpeedBar (mirrors the RadioButton 0.151 AllocRadioButtonNodeA pattern). Each class now accepts `labels: string[]` (or `buttons: string[]` for SpeedBar) in its constructor; the wrapper opens the class library, allocs one node per label via AllocChooserNodeA / AllocClickTabNodeA / AllocListBrowserNodeA / AllocSpeedButtonNodeA, links them into a freshly-allocated exec struct List, hands the List* to the class's Labels/Buttons tag at NewObject time, and frees everything at dispose. Unblocks the ~8 NDK example ports that use these classes. Also a tag-constant audit — the existing tables for CLICKTAB_*, TNA_*, LISTBROWSER_*, SPEEDBAR_*, SBNA_* were all hand-typed wrong. Caught them while adding the helpers: ClickTab TNA_Text was pointing at TNA_UserData (+1 vs the correct +7); every LISTBROWSER_* was shifted by 2 slots so `labels` was writing to LISTBROWSER_Top; every SPEEDBAR_* past Buttons was off by 1 slot; every SBNA_* was invented (SBNA_Label doesn't exist — the text tag is SBNA_Text at +16, not +5). Re-derived byte-for-byte from gadgets/chooser.h, clicktab.h, listbrowser.h, speedbar.h and the matching _lib.fd LVO tables per the feedback_amiga_tag_constants.md rule (never hand-type; re-derive). Chooser's own CHOOSER_* and CNA_* tables were correct and untouched. The `labels` ATTR on Chooser/ClickTab/ListBrowser and `buttons` ATTR on SpeedBar were renamed to `labelsPtr` / `buttonsPtr` so the `labels:` / `buttons:` array-of-strings constructor path is unambiguous; pre-built List pointers still work through the renamed ATTRS. Added LBNA / LBNCA / LBCIA / LBFLG constant namespaces and LBNCA_CopyText=TRUE default for ListBrowser nodes. Per-class LVO_ALLOC_NODE constants renamed per-class (CHOOSER_LVO_*, CLICKTAB_LVO_*, etc.) to avoid ffi-bundle.js concatenation redefinition clash with RadioButton's existing LVO_ALLOC_NODE/LVO_FREE_NODE. No runtime behavior change for RadioButton; untested on Amiga yet for Chooser/ClickTab/ListBrowser/SpeedBar — AWAITING AMIGA TEST. */  /* packed: major=0, revision=167. Emergency revert of the 0.165/0.166 dispose-and-replace path for images. User tested 0.166 and reported the probe's window grew unboundedly taller on each Next click, then hung the OS. CHILD_ReplaceImage on OS3.2 apparently doesn't have the "replace in place" semantics the header name implies — the old child isn't removed, so each replace accumulates a new label into the layout until something breaks. Without OS3.2-specific documentation of the correct tag pairing (LAYOUT_ModifyImage? CHILD_NoDispose dance? LM_* DoMethod dispatch?) I can't ship a safe runtime-update path for label.image. Reverted BOOPSIBase.set() to plain Intuition.SetAttrsA for images in open windows — text updates store internally but don't visually refresh, which is stable and predictable. The _disposeReplace helper is kept in the source as a reference implementation for future work, clearly marked UNUSED and UNSAFE in JSDoc with the 0.166 symptoms. Label.js JSDoc rewritten: Label is now documented as a STATIC-TEXT-ONLY widget, with the canonical read-only StringGadget pattern shown as the solution for runtime-mutable text. boopsi_refresh_probe.js updated to use read-only StringGadget instead of Label — exercises the working SetGadgetAttrsA-refresh path and doubles as a canonical sample. _initAttrs snapshot and OM_GET fallback to _initAttrs (from 0.166) both kept — still the right behavior, independently useful. */  /* packed: major=0, revision=166. Two follow-ups to 0.165. (1) User reported the probe's Label went BLANK after the first dispose-replace (visible initial text, then nothing). Root cause: _disposeReplace used CHILD_ReplaceObject (CHILD_Dummy+7 = 0x85007107), which is the GADGET-swap tag. layout.gadget installed the new label.image as if it were a gadget and drove it with GM_RENDER — imageclass has no GM_RENDER, so the replacement drew nothing. gadgets/layout.h:352 has a separate CHILD_ReplaceImage = LAYOUT_Dummy+8 = 0x85007008 which marks the replacement as an image (drawn via IM_DRAW matching LAYOUT_AddImage). Since _disposeReplace is only called when kind==='image' we unconditionally use CHILD_ReplaceImage now. (2) User also reported lbl.get("text") returning null after set() on Label. label.image's LABEL_Text autodoc lists (OM_GET) applicability, but OS3.2's implementation doesn't actually answer OM_GET for it — the autodoc line is a doc artifact. BOOPSIBase.get() now falls back to this._initAttrs[name] when OM_GET returns null. The snapshot is already maintained by the constructor and updated by _disposeReplace, so it's authoritative for any attr that's ever been set through the wrapper — no extra bookkeeping needed. Users can now `lbl.get("text")` (and `lbl.text` which routes through get()) and receive the last-set value even on classes with incomplete OM_GET support. */  /* packed: major=0, revision=165. Architectural pivot after 0.158→0.164 iterations failed to solve the image-text overlay bug. Diagnostic trace at 0.163 confirmed all refresh FFI calls were running correctly (WM_RETHINK returning 1, EraseRect/RectFill + RefreshGList completing without error) yet the overlay persisted. Consulting the RKRM Changes & Additions PDF (2024) and label_ic.doc pinpointed the real constraint: label.image's attributes (LABEL_Text et al) are OM_NEW-applicable only — changing them on a live image via SetAttrsA/SetGadgetAttrsA isn't guaranteed to refresh or even honor the change in OS3.2 Reaction. The canonical NDK pattern (Examples/Layout2.c:241-254) is CHILD_ReplaceObject: build a fresh BOOPSI, dispatch LAYOUT_ModifyChild+CHILD_ReplaceObject on the parent layout (which auto-disposes the old instance), then WM_RETHINK (WM_NEWPREFS fallback). This commit: (1) simplifies BOOPSIBase.set() to four clear branches — plain SetAttrsA (no window), SetGadgetAttrsA alone (gadget in window; RKRM-verified this handles refresh internally), dispose-and-replace (image in window with gadget parent), plain SetAttrsA (edge cases) — removing the WM_RETHINK + EraseRect + RefreshGList scaffolding that was making things worse rather than better. (2) Adds BOOPSIBase._initAttrs which snapshots the construction tags so the dispose-replace path can rebuild with merged (old + patch) attrs. (3) Adds _disposeReplace helper that does the full ModifyChild+ReplaceObject+WM_RETHINK sequence and swings this.ptr onto the new BOOPSI so the JS wrapper identity survives — event handlers and all. (4) Documents the pattern in Label.js JSDoc and recommends read-only StringGadget for frequently-changing text (no allocation churn, Reaction handles in-place refresh). (5) Updates quiz_demo.js to use StringGadget for the question + status lines — canonical OS3.2 idiom for dynamic text, proven working by the calculator demo. The probe at boopsi_refresh_probe.js still demonstrates Label dispose-and-replace when the user wants to test it directly. globalThis.__boopsi_trace flag still wires through the (now simpler) set() path for future diagnostics. */  /* packed: major=0, revision=164. Second diagnostic build. 0.163 trace confirmed BOOPSIBase.set() runs, WM_RETHINK returns 1, iw/rastPort are valid, EraseRect + RefreshGList both complete without error — and yet the visible overlay persists even in the minimal probe. Two outstanding hypotheses to test: (A) the window RPort coord system is not window-absolute (my (BorderLeft,BorderTop)→(Width-BorderRight-1,Height-BorderBottom-1) rect may be wrong), or (B) EraseRect's backfill-hook mechanism isn't producing visible blank pixels for some reason. 0.164 swaps EraseRect for an explicit SetAPen(rp, 0) + RectFill(rp, …) — a coord-naive flood-fill with pen 0 which makes any erase visible. If that still doesn't erase, it's not the coord system. Separately the probe now calls lbl.get("text") after each set() so the trace proves whether label.image is actually accepting OM_SET for LABEL_Text (autodoc says OM_NEW only, but the on-screen behavior suggests updates are getting through somehow). Two signals → next step: if reported text is new and RectFill visibly clears → pure smart-refresh or cache issue; if text is new but nothing erases → graphics call is going to the wrong rastport; if text is still old → label.image doesn't accept OM_SET on OS3.2 and we need a dispose+reconstruct strategy. */  /* packed: major=0, revision=163. 0.162 still shows overlay. Three consecutive refresh-strategy fixes (WM_RETHINK, RefreshGList, EraseRect) have not changed the visual symptom, which means the refresh code path may not be executing as expected — or one of the Intuition/Graphics calls is silently failing. Switching tactics: shipping diagnostic instrumentation. BOOPSIBase.set() now emits print() traces (gated on globalThis.__boopsi_trace=true so normal scripts stay silent) showing: class/kind/winPtr at entry, WM_RETHINK return code, iw + rastPort presence, EraseRect border values + computed rect, RefreshGList invocation, rootPtr value. Companion probe at amiga/examples/boopsi_refresh_probe.js opens a single-Label window and cycles its text four times with tracing on; visual + terminal output together will pinpoint whether the fault is in the JS code path, the Intuition/Graphics dispatch, or somewhere else entirely. Plan: user runs probe, reports the printed trace + what they see on screen; I diagnose from real evidence rather than guessing. */  /* packed: major=0, revision=162. Third attempt at the quiz image-overlay bug. 0.161 added Intuition.RefreshGList(rootLayout, win, NULL, -1) after WM_RETHINK — user reported no change: Q2 appears ONE LINE BELOW Q1 still drawn, "Score so far: 0" still visible under "Score: 1". The layout IS recomputing (widgets reposition) but pixels at the OLD positions persist on screen. Root cause diagnosed via direct screenshot inspection: neither WM_RETHINK nor RefreshGList erases the window's background BETWEEN gadgets. Each widget repaints only its own bounds — pixels between widgets, or formerly occupied by a widget that moved, stay stale. RefreshGList repaints gadgets over whatever was there; if the former widget's pixels now fall in a between-widget gap, nothing repaints them. Fix is to explicitly clear the window's content region before the refresh pass. Added graphics.EraseRect FFI binding (LVO -810, a1/d0/d1/d2/d3) which respects the window's backfill hook so Workbench themes render properly. Added borderLeft/borderTop/borderRight/borderBottom getters on the struct Window wrapper (BYTE fields at offsets +54/+55/+56/+57 per intuition.h). BOOPSIBase.set() now runs: update-state → WM_RETHINK → EraseRect(rport, borderLeft, borderTop, width-borderRight-1, height-borderBottom-1) → RefreshGList(rootLayout, win, NULL, -1). The erase-between-relayout-and-refresh is the piece that was missing. JS developer surface still unchanged. */  /* packed: major=0, revision=161. User tested 0.160: calculator works (text appears and updates!), quiz now shows the question + score text but new content overlays the previous values — layout shifts correctly (buttons move) but old pixels aren't erased. NDK window_cl.doc documents the exact split: WM_RETHINK = "Re-evaluate layout limits, and relayout window" (RELAYOUT ONLY) while WM_NEWPREFS = "Update window prefs and refresh window" (includes refresh). We were calling only WM_RETHINK — relayout happened, repaint didn't. Fix: after the SetGadgetAttrsA/SetAttrsA + WM_RETHINK sequence, explicitly call Intuition.RefreshGList(rootLayout, win, NULL, -1) to force a full gadget+frame erase and redraw. numGadgets=-1 means "all gadgets from firstGadget onwards AND the window frame" per intuition autodoc. Added Intuition.RefreshGList FFI binding (LVO -432, a0/a1/a2/d0) and BOOPSIBase._rootLayoutPtr helper that grabs winObj._children[0].ptr (the WINDOW_Layout the Window was built with, adopted as a JS-side child at ReactionWindow construction). set() now runs: update-state → WM_RETHINK → RefreshGList. JS developer surface still unchanged. */  /* packed: major=0, revision=160. After 0.159 the user reported neither the calculator display nor the quiz question/status labels ever updated — only button text did. Two distinct real root causes, both with direct NDK-header evidence. (A) StringGadget.js STRINGA_* tag table was off-by-one from +0x12 onwards. Every `.text = '...'` was writing to tag 0x80032013 which is STRINGA_ExitHelp (a v37 "help-key on exit" boolean), not STRINGA_TextVal at 0x80032012. A phantom STRINGA_FloatVal entry at +0x12 had displaced TextVal to +0x13 — STRINGA_FloatVal is not defined in NDK 3.2 at all. Same exact class of bug as the 0.154 GA_GZZGadget off-by-one. Re-derived the whole STRINGA table byte-for-byte from intuition/gadgetclass.h and dropped the phantom FloatVal; added a strong "re-derive from headers, never hand-type" comment mirroring the one on GA_*. (B) 0.159 called layout.gadget/RethinkLayout(layout, win, req, refresh) after SetGadgetAttrsA, which sounded right by reading the layout_gc.doc narrative but turns out not to be the NDK-canonical refresh path. NDK Examples/Layout2.c:199 actually uses `if (DoMethod(windowObject, WM_RETHINK) == 0) DoMethod(windowObject, WM_NEWPREFS);` — WM_RETHINK (classes/window.h:311, 0x570006L) is a window.class method that handles the complete RethinkLayout + window-level repaint coordination internally. Bare RethinkLayout wakes the layout up but misses the window-side invalidation that actually brings fresh pixels to the screen. Replaced every layout.rethink() call in BOOPSIBase.set() with doMethod(WM_RETHINK) dispatched on the nearest ReactionWindow ancestor (found via new _findWindowAncestor helper). Layout.RethinkLayout stays exposed as a low-level API but is no longer the default refresh path. JS developer surface still untouched: `sg.text = '7'`, `label.text = 'Correct!'`, `new Layout({children:[label, btn]})` all Just Work now with real pixels reaching the screen. */  /* packed: major=0, revision=159. Two targeted follow-ups from user testing of 0.158. After 0.158 shipped, user reported: (1) calculator_demo still shows nothing in the StringGadget display (no initial '0', no digit presses), and (2) quiz_demo shows the first question correctly but the question label + status line never update on subsequent questions; answer buttons DO relabel (Fix #3 gadget branch works). Two distinct root causes. (A) layout_gc.doc line 598 is explicit: "Setting the attributes via SetGadgetAttrs() (OM_SET) will not automatically rerender the display! Call RethinkLayout() to relayout and refresh display after SetGadgetAttrs()." RethinkLayout doc adds: "Call this function after a call SetGadgetAttrs() returns 1 to display the changes in the layout. According to BOOPSI rules, a gadget will return a value equal or greater than 1 from OM_SET to tell the application to refresh." So 0.158's Fix #3 image-via-LAYOUT_ModifyChild path only updated internal state — the redraw never happened. Fix: Layout.js now exposes layout.gadget's RethinkLayout (LVO -48, a0/a1/a2/d0) as `Layout.RethinkLayout(layout,win,req,refresh)` static plus `layout.rethink(win,refresh=true)` instance method. Layout gains a `static _isLayout = true` marker that Page/Virtual inherit. BOOPSIBase adds `_findLayoutAncestor()` that walks _parent looking for any node with _isLayout. set() now calls `layout.rethink(win,true)` after every SetGadgetAttrsA in an open window — whether the image-LAYOUT_ModifyChild path or the direct-gadget path — so geometry or content changes get a full re-lay-out + repaint. (B) NDK Examples/String.c always includes STRINGA_MinVisible on every string.gadget instantiation. Without it, the layout gives string.gadget effectively zero visible width — the internal buffer holds '0' perfectly, but the pixels on screen show nothing. Fix: StringGadget constructor now defaults minVisible to clamp(maxChars, 4, 40) when the caller passed maxChars, otherwise 10 (matching NDK example convention). Callers can still override minVisible: explicitly. JS developer surface still unchanged — `new StringGadget({text, maxChars, readOnly})` and `sg.text = 'new'` both work without any extra ceremony, and image-child `label.text = 'new'` now properly repaints. */  /* packed: major=0, revision=158. Three correctness fixes on the Reaction OO layer surfaced by real end-to-end testing of the 0.157 demo batch. User ran calculator_demo and quiz_demo on the Amiga and reported: (1) the calculator display shows no digits ever; (2) the quiz shows no question or status text and clicking the answer buttons produces no visible change. Root causes identified against NDK autodocs, each one local to the JS wrappers and leaving the public JS API (`gadget.text = ...`, `new Layout({children:[...]})`) completely unchanged. (A) Layout.js unconditionally dispatched every child via LAYOUT_AddChild — but label.image / bevel.image / led.image / glyph.image / bitmap.image are imageclass subclasses and must be added via LAYOUT_AddImage so layout.gadget calls IM_DRAW on them; LAYOUT_AddChild reserves space and then calls GM_RENDER which imageclass doesn't implement, so every Label sat invisibly in the layout (quiz's qLabel, stLabel; react_hello.js's "Hello from Reaction!" label was also silently blank). Layout.js now branches per child on (c instanceof ImageBase). (B) StringGadget.js inherited `text` → GA_Text from GADGET_ATTRS, but string_gc.doc line 309 is explicit that GA_Text is not supported by string.gadget — STRINGA_TextVal (0x80032013) is the intended content tag. Calculator display never showed anything because GA_Text was simply discarded. StringGadget.ATTRS now overrides `text` to map to STRINGA.TextVal with type 'string-owned', and `textVal` alias removed. (C) BOOPSIBase.set() called Intuition.SetAttrsA — the raw OM_SET dispatch, internal state only. layout_gc.doc is explicit: "If using OM_SET, you MUST call through SetGadgetAttrs() to protect the window layout properly." So `display.text = '7'` updated string.gadget's buffer but never repainted. set() now inspects the object kind (new _boopsiKind static markers on GadgetBase='gadget', ImageBase='image') and walks the _parent chain for an open window; if a gadget is in an open window it dispatches Intuition.SetGadgetAttrsA(this, win, 0, tags); if an image is a child of a gadget-layout in an open window it wraps tags with a LAYOUT_ModifyChild prefix and dispatches through the parent layout (imageclass has no GM_RENDER — layout re-lays-out and redraws its image children). Pre-open and orphan-wrapper cases fall through to the old SetAttrsA path (no live window, no refresh needed; next render pulls fresh state). BOOPSIBase._buildTagList now delegates to a _buildPairs helper so set() can mutate the pair list before marshaling; _findWindowPtr walks _parent up to the ReactionWindow's _intuiWindow. Added Intuition.SetGadgetAttrsA FFI binding (LVO -660, a0/a1/a2/a3). Added LAYOUT.ModifyChild = 0x85007016 (gadgets/layout.h:185). JS developer surface is unchanged: `btn.text = 'x'` / `label.text = 'x'` / `sg.text = 'x'` / `set({disabled:true})` / `new Layout({children:[label, button, bevel]})` all work; wrapper routes internally. */  /* packed: major=0, revision=157. Two ergonomics improvements layered on top of 0.156's working OO layer. (1) page.gadget wrapper now overrides constructor so children:[] becomes PAGE_Add tags (one per page) instead of inheriting Layout's LAYOUT_AddChild conversion. tabs_demo.js no longer needs the manual _extraPairs workaround. (2) Window._translateWmhi got a Phase D refinement — _fillAttrsForClass auto-populates event.attrs with the most-relevant current attribute for each gadget class right after WMHI_GADGETUP routing. So a SLIDER_CHANGE event arrives with event.attrs.level already filled in (via OM_GET round-trip); CHECKBOX_TOGGLE has event.attrs.selected; STRING_CHANGED has event.attrs.text; etc. Handlers no longer need a separate event.source.get('level') call after every event. The pull() inner function silently swallows OM_GET failures so an unknown attribute on a future class doesn't blow up the event pump. */  /* packed: major=0, revision=156. With 0.155 button events fire correctly (BUTTON_CLICK id=1/id=2 reach the user) but evt.source.text returned the raw STRPTR ("1074164472") instead of decoding it to "Say hi". The ATTR_TYPES table in BOOPSIBase had a 'string' codec but no 'string-owned' codec — encode for 'string-owned' is special-cased in _buildTagList (alloc + poke + track for dispose), but decode just fell through `if (!codec) return raw;` returning the unwrapped pointer. Added 'string-owned' to ATTR_TYPES with the same decode as 'string' (peekString), and a fallback encode that handles the SetAttrsA path with a pre-allocated STRPTR. Fix is one entry. */  /* packed: major=0, revision=155. With 0.154's GA_* fix in place, react_hello showed WMHI_GADGETUP fires correctly (event: GADGET_UP printed twice for the two clicks) but the kind upgrade to BUTTON_CLICK didn't happen — event.source was null because Window._buildIdMap walked an empty Window._children. Reason: the Layout was passed in via the `layout:` tag (becomes WINDOW_Layout), so BOOPSIBase's children-pump never registered it as a JS-side child. The id-map walker therefore had nothing to walk. Fix in Window.constructor: after super(), if init.layout is a BOOPSIBase (duck-typed by Array.isArray(init.layout._children)), call this.addChild(layout). That sets layout._parent=window and pushes layout into Window._children. _buildIdMap now walks Window → Layout → [Label, Button1, Button2], finds Buttons by GA_ID, returns the right BOOPSIBase, _translateWmhi upgrades event.kind to BUTTON_CLICK. addChild is JS-only bookkeeping (no OM_ADDMEMBER) so there's no double-add on the Reaction side; the layout was already adopted via WINDOW_Layout. dispose cascade: window.dispose calls Intuition.DisposeObject on window which natively cascades to layout + children; JS-side _markDisposed walks _children and propagates the disposed flag, idempotent so no double-free. */  /* packed: major=0, revision=154. THE BUG behind every "buttons silent" report from 0.144 onwards. The GA_* tag table in boopsi/GadgetBase.js was off-by-one starting at GA_ID because GA_GZZGadget at GA_Dummy+15 (between GA_Disabled+14 and GA_ID+16) was accidentally collapsed when the table was hand-typed. Result: every GA_* from GA_ID onwards was misnumbered. The most damaging consequence: setting GA_RelVerify=TRUE on a Button actually wrote tag 0x80030015, which is GA_Immediate. So our buttons got Activation=GACT_IMMEDIATE (0x0002 — "fire on press" = IDCMP_GADGET_DOWN) instead of GACT_RELVERIFY (0x0001 — "fire on release" = IDCMP_GADGET_UP). Buttons therefore generated GADGET_DOWN events but never GADGET_UP, never IDCMPUPDATE, never WMHI_GADGETUP. Diagnosis traced through 8 probe scripts: probe3 showed GA_ID readback as 0xFFFFFFFF (smoke); probe4 confirmed only GADGET_DOWN messages on the wire; probe6 dumped struct Gadget showing Activation=0x0002 (=GACT_IMMEDIATE); probe7 verified makeTags bytes correct; probe8 dumped class structure (chain intact) and SetAttrsA also produced Activation=0x0002 from GA_RelVerify=TRUE — the proof. Cross-referenced gadgetclass.h: GA_GZZGadget at offset 15, then GA_ID at 16. Fixed the entire table; also added GA_GZZGadget, GA_Underscore, GA_ActivateKey, GA_BackFill, GA_GadgetHelpText, GA_Hidden, GA_CustomMousePointer, GA_PointerType, GA_ParentHidden which were missing entirely. The 0.151 (LAYOUT_RelVerify defaults), 0.152 (ICA_TARGET=ICTARGET_IDCMP), and 0.153 (WM_HANDLEINPUT pivot) changes were all founded on incorrect downstream symptoms. The 0.153 WM_HANDLEINPUT-based event pump is the right canonical Reaction architecture per NDK Examples/String.c and remains in place. Layout no longer defaults relVerifyNotify or icaTarget — also remains in place (canonical). Default IDCMP also stays absent (window.class picks). Lesson recorded in GadgetBase.js comment: "never copy GA_* values by hand from memory — always re-derive against gadgetclass.h." */  /* packed: major=0, revision=153. ARCHITECTURAL PIVOT after 0.151 (LAYOUT_RelVerify) and 0.152 (ICA_TARGET=ICTARGET_IDCMP) both failed to surface button clicks despite being mechanically correct per layout_gc.doc and icclass.h. The hybrid we'd built (window.class object + raw GetMsg loop on the UserPort + manual IDCMPUPDATE TagList parsing) is not the canonical Reaction pattern. NDK Examples/String.c (the authoritative WindowObject example) and every other Reaction.lib sample use WM_HANDLEINPUT (alias RA_HandleInput) — DoMethod(win, WM_HANDLEINPUT, &code) returns a packed ULONG (WMHI_class << 16) | data, where WMHI_GADGETUP carries the GA_ID directly in the low word, no TagList walking required. window.class internally manages the IDCMPUPDATE/ICA_TARGET wiring + GADGETUP routing, so user code doesn't set those at all (String.c sets neither LAYOUT_RelVerify nor ICA_TARGET on its layout). Likely failure mode of the previous approach: window.class owns the UserPort and consumes some IntuiMessages internally for its own state machine (iconification, prefs notify, etc) — direct GetMsg sees what it doesn't claim, leaving gadget releases stuck in window.class's internal queue waiting for WM_HANDLEINPUT to drain them. Pivot in Window._translateMessage → _translateWmhi: WM_HANDLEINPUT result decoded by class case (WMHI_GADGETUP/CLOSEWINDOW/ACTIVE/INACTIVE/NEWSIZE/RAWKEY/VANILLAKEY/MENUPICK/MENUHELP/CHANGEWINDOW/INTUITICK/MOUSEMOVE/MOUSEBUTTONS/GADGETHELP). For WMHI_GADGETUP, looks the source up by GA_ID via JS-side child registry, upgrades event.kind to BUTTON_CLICK / CHECKBOX_TOGGLE / RADIO_SELECT etc via EventKind.fromGadgetClass. events() loop now: Wait(WINDOW_SigMask) → inner while WM_HANDLEINPUT != WMHI_LASTMSG. Window constructor defaults idcmp to IDCMP_REACTION_DEFAULT (includes GADGET_UP — the user's react_hello.js mask was missing it so even WM_HANDLEINPUT couldn't have surfaced button clicks). Layout no longer defaults relVerifyNotify or icaTarget — the attrs remain available for users who want to consume IDCMP_IDCMPUPDATE directly the Layout1.c way (raw OpenWindowTags + GetMsg). Kept the old _translateMessage + _walkUpdateTags methods around for that future use case but events() doesn't call them. Dispose now frees the UWORD code buffer used by WM_HANDLEINPUT's &code out-param. react_hello.js dropped the explicit idcmp mask; relies on the new default. */  /* packed: major=0, revision=152. After 0.151 the user reported buttons STILL silent — react_hello opens, ACTIVE_WINDOW + CLOSE_WINDOW fire, button clicks produce nothing (not even a raw IDCMPUPDATE-classed event). Root cause: LAYOUT_RelVerify makes layout.gadget call OM_NOTIFY on itself, but OM_NOTIFY is silently dropped unless the object has ICA_TARGET set. Per icclass.h:33-46, the special value ICTARGET_IDCMP (~0L = 0xFFFFFFFF) is what bridges OM_NOTIFY to the window's IDCMP port as IDCMP_IDCMPUPDATE. NDK Examples/Layout1.c:67 (raw GetMsg architecture, like ours) sets ICA_TARGET=ICTARGET_IDCMP on the top layout. Examples/String.c (uses RA_HandleInput) does not need to — WM_HANDLEINPUT wires it internally. We use the hybrid (window.class + GetMsg loop) and never wired ICA_TARGET, so layout's notifications went nowhere. Fix: Layout.constructor now defaults `icaTarget = ICTARGET_IDCMP` (added as a uint32 attr → tagID 0x80040001). Sub-layouts get the same treatment — each broadcasts its own children's events to IDCMP, no duplicates because each gadgetup notifies its containing layout exactly once. Also fixed a downstream parser bug: Window._translateMessage read msg.iaddress (lowercase a) but IntuiMessage only defines iAddress (uppercase A) — IDCMPUPDATE TagList parsing was unreachable code. Both issues had to be fixed together to test. */  /* packed: major=0, revision=151. TWO real bugs found after user reported button clicks still silent everywhere at 0.150. (1) LAYOUT_RelVerify=TRUE was never set on our Layout objects. Per layout_gc.doc:320-330, this is the enable bit for Reaction to emit IDCMP_IDCMPUPDATE broadcasts on child gadget releases — WITHOUT it, buttons fire GADGET_UP internally but Reaction swallows them and the window never sees an IntuiMessage. Distinct from GA_RelVerify (per-child release-verify inherited from GADGET_ATTRS); BOTH are required. LAYOUT_RelVerify = LAYOUT_Dummy+23 = 0x85007017. Added `relVerifyNotify` attr + defaulted true in Layout.constructor. Also parse LAYOUT_RelVerify, LAYOUT_RelCode (0x85007018), LAYOUT_TabVerify (0x85007021) out of the IDCMPUPDATE TagList in Window._translateMessage, populating event.raw.code from LAYOUT_RelCode. (2) RADIOBUTTON_Strings is "RESERVED - presently unsupported" per radiobutton.h:49 — always returns empty UI. The ONLY working OS3.2 path is RADIOBUTTON_Labels with a struct List of RBNA-attribute nodes built via AllocRadioButtonNodeA (radiobutton.gadget LVO -36). RadioButton class rewritten: now accepts `labels: ['_A','_B','_C']` as a constructor sugar; internally opens the class library, allocs one node per label, links them into a freshly-allocated struct List, hands the List* to RADIOBUTTON_Labels at NewObject time, and frees everything at dispose via FreeRadioButtonNode (LVO -42). radiobutton_demo.js rewritten to use the new API. */  /* packed: major=0, revision=150. New classes/requester.class wrapper (Requester) with RequesterType + RequesterImage enums and openReq()/closeReq() method helpers. Method IDs RM_OPENREQ=0x450001, RM_CLOSEREQ=0x450002 (per classes/requester.h, same plain-integer namespace as WM_OPEN). New example ports: bevels_demo (every BevelStyle), glyph_demo (every GlyphKind), requester_demo (modal info+OK/Cancel). */  /* packed: major=0, revision=149. amiga.makeStringArray + amiga.withStringArray helpers. Builds a NULL-terminated STRPTR array suitable for tags like RADIOBUTTON_Strings or CHOOSER_LabelArray from a JS array of strings. Returns {ptr, free()} — free() releases all strings + the array in one call. radiobutton_demo.js rewritten to use the helper. Class-specific struct-Node lists (e.g. CHOOSER_Labels, LISTBROWSER_Labels, SPEEDBAR_Buttons) still require their class-specific AllocXXXNode allocators; documented in the helper's comment. */  /* packed: major=0, revision=148. Phase C: comprehensive Reaction gadget/image wrappers. New classes in boopsi/images/: Led, Bevel, Glyph, Bitmap. New classes in boopsi/gadgets/: CheckBox, RadioButton, Slider, Scroller, Integer, StringGadget, Chooser, ClickTab, ListBrowser, Palette, Space, FuelGauge, SpeedBar, GetFile, GetFont, GetScreenMode, GetColor, DateBrowser, TextEditor, SketchBoard, TapeDeck, ColorWheel, GradientSlider, Page (extends Layout), Virtual (extends Layout). 25 new wrappers. Each: correct _classLibName with gadgets/ or images/ prefix, ATTR_TYPES mapping for class-specific tags, sensible defaults (relVerify=true for interactive gadgets to fire events). Each interactive class registers its own EventKind (CHECKBOX_TOGGLE, RADIO_SELECT, SLIDER_CHANGE, SCROLLER_CHANGE, INTEGER_CHANGED, STRING_CHANGED, CHOOSER_SELECT, CLICKTAB_CHANGE, LIST_SELECT, PALETTE_CHANGE, SPEEDBAR_CLICK, FILE_SELECTED, FONT_SELECTED, SCREENMODE_SELECTED, COLOR_SELECTED, DATE_CHANGE, TEXT_CHANGE, SKETCH_UPDATE, TAPEDECK_CLICK, COLORWHEEL_CHANGE, GRADIENT_CHANGE). Also exposes value enums (SliderOrient, ChooserJustify, GlyphKind, BevelStyle, StringHookType, TapeDeckMode, FuelGaugeOrient) and node-attribute namespaces (CNA for chooser nodes, TNA for clicktab, SBNA for speedbar). Registered under amiga.boopsi.<Name> flat + amiga.boopsi.{classes,gadgets,images}.<Name> namespaced. gen/ffi-bundle.js grew substantially due to the pure-JS class count. */  /* packed: major=0, revision=147. amiga.makeTags + amiga.withTags now accept three input shapes: the original pair-array ([[tag,data], ...]), a flat array with adjacent tag/data slots ([tag,data,tag,data,...], optional trailing TAG_END=0), or variadic args (makeTags(WA_Title,'foo',WA_Width,200)). Normalized in JS via amiga._normalizeTagInput — native side still consumes pair-array. Solves the pet-peeve of nested-array punctuation in hand-written code. Existing call sites continue to work unchanged. */  /* packed: major=0, revision=146. (1) Fixed wrong IDCMP_IDCMPUPDATE value — was 0x40000000 in EventKind.js + Button.js + react_hello.js; real is 0x00800000 per intuition.h:887. Consequence: Reaction button-click events were never dispatched because the mask bit was invalid and BUTTON_CLICK never matched. (2) Registered a COMPLETE catalog of IDCMP EventKinds — every IDCMP_* class from intuition.h:863-893 except LONELY_MESSAGE (system-internal). Exposed as amiga.boopsi.IDCMP enum + amiga.boopsi.IDCMP_REACTION_DEFAULT convenience mask. (3) IDCMP_IDCMPUPDATE TagList parser in Window._translateMessage walks iaddress, pulls GA_ID (and any extra tags), resolves event.source by walking the JS child registry (BOOPSIBase._id set from init.id), and upgrades event.kind to the class-specific case (e.g. BUTTON_CLICK) via EventKind.fromGadgetClass. react_hello.js updated to use new semantics — prints BUTTON_CLICK id/text and quits on id=2. */  /* packed: major=0, revision=145. Button GA_RelVerify default. After 0.144 react_hello opened a visible window and close-gadget / events iteration / dispose all worked, user reported button clicks produced no events. Cause: NDK PushButton macro (reaction_macros.h:249) always sets GA_RelVerify=TRUE, but our Button class never set it — a bare button.gadget renders but never reports clicks. Added relVerify + immediate to GADGET_ATTRS in boopsi/GadgetBase.js, and Button.constructor defaults relVerify=true unless explicitly overridden. User can still pass relVerify:false for a silent visual-only button. Expected outcome: react_hello's Say hi / Quit buttons now print ATTR_UPDATE lines when clicked. Phase D refinement will parse the IDCMPUPDATE TagList to resolve event.sourceId from GA_ID. */  /* packed: major=0, revision=144. Fix BOOPSI doMethod dispatch — js_amiga_doMethod in library/vbcc/amiga_ffi.c was reading the Class's cl_Dispatcher Hook at offset +36, but cl_Dispatcher is the FIRST field of struct IClass (offset 0) per intuition/classes.h:31-42 on OS3.2. Consequently h_Entry was read from cl+44, which lands somewhere past cl_UserData / cl_SubclassCount — garbage. Jumping to that address produced Address Error Guru 80000003 the first time any BOOPSI method was dispatched (construction goes through Intuition.NewObjectA which bypasses this path, so the bug only fired at WM_OPEN in react_hello). Discovered by probe1 reading IClass fields on the Amiga: h_Entry at cl+8 = 0x421c5678 (valid label.image code ptr), cl+36 area held unrelated fields. Also confirmed by probe2 — everything through A..F construction worked, Guru struck at G's w2.open(). Fix: hook = cl; h_entry = *(cl + 8). */  /* packed: major=0, revision=143. BOOPSIBase.NewObjectA argument order was swapped. Per intuition.library/NewObjectA (intuition.doc:3807-3814): `object = NewObjectA(class, classID, tagList)` with registers a0/a1/a2. We always construct from a private Class*, so classID must be NULL. Old code: NewObjectA(0, classPtr, tags) — passed NULL as class and the Class* pointer as classID (an APTR that Intuition dereferences as a NUL-terminated string name); read garbage bytes, found no matching public class, returned NULL. After 0.142 exposed this as "Label: NewObjectA returned 0". Fix in BOOPSIBase.js:169 changes call to NewObjectA(classPtr, 0, tags). Affects every BOOPSI wrapper — Window, Layout, Button, Label all routed through the same constructor. Expected effect: react_hello now constructs the Label, Buttons, Layout, and Window successfully, reaches win.open(), and (with 0.141's WM_OPEN fix) should render a visible 260x100 window. */  /* packed: major=0, revision=142. Reaction class-library path fix. With 0.141's silent-eval bug fixed, the first visible Amiga error at react_hello was `Label: cannot open label.image (v40+ required)`. Per NDK3.2R4/Examples (Connect.c:72-74, Bevels.c:58-60, etc.) the canonical OpenLibrary names for Reaction components on OS3.2 are path-prefixed: `images/label.image`, `gadgets/button.gadget`, `gadgets/layout.gadget`. Only `window.class` is bare (LIBS: root). Before this fix OpenLibrary("label.image", 40) returned 0 on OS3.2 because the file lives at LIBS:images/label.image, not LIBS:label.image. Fixed the three BOOPSI wrappers' _classLibName fields. (1) QJS_EvalBuf_impl in library/vbcc/qjsfuncs.c was missing js_std_await after JS_EvalFunction on the module path. JS_EvalFunction returns a Promise for modules; a rejected promise is not itself a JS exception, so JS_IsException was always false and the library returned 0 ("success") even when the module threw at top level. All module-level exceptions (any uncaught throw in any .js example invoked via `qjs file.js`) have been silently discarded since modules landed. Canonical pattern is used by the upstream qjs.c:210 and by js_std_eval_binary (quickjs-libc.c:6118). (2) Window.js WM_OPEN/WM_CLOSE were 0x85025041/0x85025042 — invented off WINDOW_Dummy as if methods lived in the tag namespace. BOOPSI method IDs are plain integers; per classes/window.h:307-308 they are 0x570002 and 0x570003. With both fixed, react_hello.js should open a visible 260x100 centered Reaction window with a label + two buttons. If the window still fails to appear the user will now see the actual error instead of a silent exit. */
#define LIBRARY_REVISION   0   /* redundant; kept for convention */
#define LIBRARY_BASE_TYPE struct QJSLibBase

/* ---- Function declarations ---- */

/* These use VBCC's __reg() syntax for register parameters */

struct JSRuntime *QJS_NewRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base);

void QJS_FreeRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

struct JSContext *QJS_NewContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

struct JSContext *QJS_NewContextRaw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_FreeContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

const char *QJS_GetVersion(
    __reg("a6") LIBRARY_BASE_TYPE *base);

void QJS_SetMemoryLimit(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG limit);

void QJS_SetMaxStackSize(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG stack_size);

void QJS_RunGC(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

int QJS_AddBaseObjects(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddEval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddDate(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddRegExp(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddJSON(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddProxy(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddMapSet(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddTypedArrays(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddPromise(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddWeakRef(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddDOMException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_AddPerformance(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

/* --- Batch 1: Runtime --- */

void QJS_SetRuntimeInfo(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") const char *info);

void *QJS_GetRuntimeOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_SetRuntimeOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *opaque);

void QJS_UpdateStackTop(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_SetDumpFlags(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") unsigned long long *flags_ptr);

void QJS_GetDumpFlags(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") unsigned long long *result_ptr);

ULONG QJS_GetGCThreshold(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt);

void QJS_SetGCThreshold(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG threshold);

int QJS_IsLiveObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") JSValue *obj_ptr);

/* --- Batch 1: Context --- */

struct JSContext *QJS_DupContext(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void *QJS_GetContextOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void QJS_SetContextOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *opaque);

struct JSRuntime *QJS_GetRuntime(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void QJS_SetClassProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG class_id,
    __reg("a2") JSValue *obj_ptr);

void QJS_GetClassProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG class_id);

void QJS_GetFunctionProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

int QJS_AddBigInt(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

void QJS_AddRegExpCompiler(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

/* --- Batch 1: Comparison --- */

int QJS_IsEqual(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

int QJS_IsStrictEqual(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

int QJS_IsSameValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

int QJS_IsSameValueZero(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *op1_ptr,
    __reg("a2") JSValue *op2_ptr);

/* --- Batch 1: Memory/Finalizer --- */

void QJS_ComputeMemoryUsage(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *s);

int QJS_AddRuntimeFinalizer(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *finalizer,
    __reg("a2") void *arg);

/* --- Batch 2: Value Management --- */

void QJS_FreeValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

void QJS_FreeValueRT(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") JSValue *val_ptr);

void QJS_DupValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

void QJS_DupValueRT(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSRuntime *rt,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 2: Value Creation --- */

void QJS_NewNumber(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") double *d_ptr);

void QJS_NewBigInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") long long *v_ptr);

void QJS_NewBigUint64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") unsigned long long *v_ptr);

/* --- Batch 2: Strings --- */

void QJS_NewStringLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *str,
    __reg("d0") ULONG len);

void QJS_NewAtomString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *str);

void QJS_ToString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

void QJS_ToPropertyKey(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

const char *QJS_ToCStringLen2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") ULONG *plen,
    __reg("a1") JSValue *val_ptr,
    __reg("d0") int cesu8);

void QJS_FreeCString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *ptr);

/* --- Batch 2: Conversion --- */

int QJS_ToBool(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

int QJS_ToInt32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") long *pres,
    __reg("a1") JSValue *val_ptr);

int QJS_ToInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") long long *pres,
    __reg("a1") JSValue *val_ptr);

int QJS_ToFloat64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a2") double *pres,
    __reg("a1") JSValue *val_ptr);

void QJS_ToNumber(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 2: Objects --- */

void QJS_NewObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

void QJS_NewObjectClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG class_id);

void QJS_NewObjectProto(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *proto_ptr);

void QJS_NewArray(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

int QJS_IsArray(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr);

int QJS_IsFunction(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

int QJS_IsConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

void QJS_GetGlobalObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

void QJS_ToObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 2: Exceptions --- */

void QJS_Throw(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *obj_ptr);

void QJS_GetException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

int QJS_HasException(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx);

int QJS_IsError(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr);

void QJS_NewError(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

void QJS_ThrowOutOfMemory(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx);

/* --- Batch 2: Detect Module --- */

int QJS_DetectModule(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") const char *input,
    __reg("d0") ULONG input_len);

/* --- Batch 2: Memory Allocation --- */

void *QJS_Malloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG size);

void QJS_Free(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *ptr);

void *QJS_Realloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *ptr,
    __reg("d0") ULONG size);

void *QJS_Calloc(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG count,
    __reg("d1") ULONG size);

void *QJS_Mallocz(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG size);

char *QJS_Strdup(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str);

/* --- Batch 3: Property Get --- */

void QJS_GetProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") ULONG prop);

void QJS_GetPropertyUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") ULONG idx);

void QJS_GetPropertyStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("a3") const char *prop_str);

void QJS_GetPropertyInt64(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("d0") LONG idx);

/* --- Batch 3: Property Set (engine CONSUMES val) --- */

int QJS_SetProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop,
    __reg("a2") JSValue *val_ptr);

int QJS_SetPropertyUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG idx,
    __reg("a2") JSValue *val_ptr);

int QJS_SetPropertyStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("a2") const char *prop_str,
    __reg("a3") JSValue *val_ptr);

/* --- Batch 3: Property Query/Delete --- */

int QJS_HasProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop);

int QJS_DeleteProperty(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") ULONG prop,
    __reg("d1") int flags);

/* --- Batch 3: Prototype --- */

int QJS_SetPrototype(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") JSValue *proto_ptr);

void QJS_GetPrototype(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *val_ptr);

/* --- Batch 3: Length --- */

int QJS_GetLength(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("a2") long long *pres);

int QJS_SetLength(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") LONG len);

/* --- Batch 3: Extensibility/Seal/Freeze --- */

int QJS_IsExtensible(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

int QJS_PreventExtensions(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

int QJS_SealObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

int QJS_FreezeObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr);

/* --- Batch 3: Define Property (engine CONSUMES val) --- */

int QJS_DefinePropertyValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG prop,
    __reg("a2") JSValue *val_ptr,
    __reg("d1") int flags);

int QJS_DefinePropertyValueUint32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("d0") ULONG idx,
    __reg("a2") JSValue *val_ptr,
    __reg("d1") int flags);

int QJS_DefinePropertyValueStr(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *this_ptr,
    __reg("a2") JSValue *val_ptr,
    __reg("a3") const char *prop_str,
    __reg("d0") int flags);

/* --- Batch 3: Opaque --- */

int QJS_SetOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a1") JSValue *obj_ptr,
    __reg("a0") void *opaque);

void *QJS_GetOpaque(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *obj_ptr,
    __reg("d0") ULONG class_id);

void *QJS_GetOpaque2(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *obj_ptr,
    __reg("d0") ULONG class_id);

/* --- Batch 3: Own Property Names --- */

int QJS_GetOwnPropertyNames(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void **ptab,
    __reg("a2") ULONG *plen,
    __reg("a3") JSValue *obj_ptr,
    __reg("d0") int flags);

void QJS_FreePropertyEnum(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") void *tab,
    __reg("d0") ULONG len);

/* --- Batch 3: InstanceOf --- */

int QJS_IsInstanceOf(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr,
    __reg("a2") JSValue *obj_ptr);

/* --- Batch 4: Atoms --- */

ULONG QJS_NewAtomLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str,
    __reg("d0") ULONG len);

ULONG QJS_NewAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *str);

ULONG QJS_NewAtomUInt32(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG n);

ULONG QJS_DupAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG v);

void QJS_FreeAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("d0") ULONG v);

void QJS_AtomToValue(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG atom);

void QJS_AtomToString(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("d0") ULONG atom);

const char *QJS_AtomToCStringLen(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *plen,
    __reg("d0") ULONG atom);

ULONG QJS_ValueToAtom(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") JSValue *val_ptr);

/* --- Batch 4: Eval --- */

void QJS_EvalFunction(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *fun_ptr);

/* --- Batch 4: Call (argv via d1 as ULONG for >4 addr params) --- */

void QJS_Call(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *func_ptr,
    __reg("a3") JSValue *this_ptr,
    __reg("d0") int argc,
    __reg("d1") ULONG argv_addr);

void QJS_Invoke(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *this_ptr,
    __reg("a3") JSValue *argv,
    __reg("d0") ULONG atom,
    __reg("d1") int argc);

void QJS_CallConstructor(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *func_ptr,
    __reg("a3") JSValue *argv,
    __reg("d0") int argc);

/* --- Batch 4: JSON --- */

void QJS_ParseJSON(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *buf,
    __reg("a3") const char *filename,
    __reg("d0") ULONG buf_len);

void QJS_JSONStringify(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") JSValue *obj_ptr);

/* --- Batch 4: Serialization --- */

unsigned char *QJS_WriteObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") ULONG *psize,
    __reg("a2") JSValue *obj_ptr,
    __reg("d0") int flags);

void QJS_ReadObject(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const unsigned char *buf,
    __reg("d0") ULONG buf_len,
    __reg("d1") int flags);

/* --- Batch 4: Class --- */

ULONG QJS_NewClassID(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") ULONG *pclass_id);

int QJS_NewClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("a1") void *class_def,
    __reg("d0") ULONG class_id);

int QJS_IsRegisteredClass(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSRuntime *rt,
    __reg("d0") ULONG class_id);

ULONG QJS_GetClassID(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *val_ptr);

/* --- Batch 5: Modules --- */
void QJS_SetModuleLoaderFunc(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *normalize_func, __reg("a2") void *loader_func, __reg("a3") void *opaque);
void QJS_GetImportMeta(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") void *m);
ULONG QJS_GetModuleName(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m);
void QJS_GetModuleNamespace(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") void *m);
void *QJS_NewCModule(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *name_str, __reg("a2") void *func);
int QJS_AddModuleExport(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") const char *name_str);
int QJS_SetModuleExport(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") const char *export_name, __reg("a3") JSValue *val_ptr);
int QJS_ResolveModule(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr);
ULONG QJS_GetScriptOrModuleName(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("d0") int n_stack_levels);
/* --- Batch 5: C Functions --- */
void QJS_NewCFunction2(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") void *func, __reg("a3") const char *name, __reg("d0") int length, __reg("d1") int cproto, __reg("d2") int magic);
int QJS_SetConstructor(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *func_ptr, __reg("a2") JSValue *proto_ptr);
int QJS_SetPropertyFunctionList(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr, __reg("a2") void *tab, __reg("d0") int len);
/* --- Batch 5: Jobs --- */
int QJS_IsJobPending(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
int QJS_ExecutePendingJob(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *pctx);
/* --- Batch 5: Promise --- */
void QJS_NewPromiseCapability(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") JSValue *resolving_funcs);
int QJS_PromiseState(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *promise_ptr);
void QJS_PromiseResult(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") JSValue *promise_ptr);
int QJS_IsPromise(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
/* --- Batch 5: Callbacks --- */
void QJS_SetInterruptHandler(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *cb, __reg("a2") void *opaque);
void QJS_SetHostPromiseRejectionTracker(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *cb, __reg("a2") void *opaque);
void QJS_SetCanBlock(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("d0") int can_block);
/* --- Batch 5: ArrayBuffer --- */
void QJS_NewArrayBufferCopy(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const unsigned char *buf, __reg("d0") ULONG len);
unsigned char *QJS_GetArrayBuffer(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") ULONG *psize, __reg("a2") JSValue *obj_ptr);
int QJS_IsArrayBuffer(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
void QJS_DetachArrayBuffer(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr);
unsigned char *QJS_GetUint8Array(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") ULONG *psize, __reg("a2") JSValue *obj_ptr);
void QJS_NewUint8ArrayCopy(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const unsigned char *buf, __reg("d0") ULONG len);
/* --- Batch 5: Type checks, Symbol, Date, Misc --- */
int QJS_IsDate(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
int QJS_IsRegExp(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
int QJS_IsMap(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
int QJS_IsSet(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *val_ptr);
void QJS_NewSymbol(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const char *description, __reg("d0") int is_global);
void QJS_NewDate(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") double *epoch_ms_ptr);
void QJS_SetIsHTMLDDA(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *obj_ptr);
int QJS_SetConstructorBit(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") JSValue *func_ptr, __reg("d0") int val);
void QJS_LoadModule(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") JSValue *result, __reg("a1") struct JSContext *ctx, __reg("a2") const char *basename, __reg("a3") const char *filename);
/* --- New functions (post-v0.54) --- */
void *QJS_GetLibcOpaque(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_SetLibcOpaque(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt, __reg("a1") void *opaque);
int QJS_AddModuleExportList(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") void *tab, __reg("d0") int len);
int QJS_SetModuleExportList(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") void *m, __reg("a2") void *tab, __reg("d0") int len);
long QJS_EvalBuf(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *input, __reg("d0") ULONG input_len, __reg("a2") const char *filename, __reg("d1") int eval_flags);
/* --- Module init / std helpers (quickjs-libc in library) --- */
void *QJS_InitModuleStd(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *module_name);
void *QJS_InitModuleOS(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *module_name);
void *QJS_InitModuleBJSON(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const char *module_name);
void QJS_StdInitHandlers(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_StdFreeHandlers(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_StdAddHelpers(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("d0") int argc, __reg("a1") char **argv);
int QJS_StdLoop(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx);
void QJS_StdEvalBinary(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") const void *buf, __reg("d0") ULONG buf_len, __reg("d1") int flags);
void QJS_StdDumpError(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx);
void *QJS_LoadFile(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx, __reg("a1") ULONG *pbuf_len, __reg("a2") const char *filename);
void QJS_SetModuleLoader(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSRuntime *rt);
void QJS_InstallExtended(__reg("a6") LIBRARY_BASE_TYPE *base, __reg("a0") struct JSContext *ctx);

/* Worker primitive — docs/WORKER_API.md */
struct QJSWorker;
typedef int (*QJSWorkerJobFn)(struct QJSWorker *worker, void *user_data);
struct QJSWorker *QJS_WorkerSpawn(__reg("a6") LIBRARY_BASE_TYPE *base,
                                  __reg("a0") QJSWorkerJobFn job_fn,
                                  __reg("a1") void *user_data,
                                  __reg("d0") unsigned long flags);
long QJS_WorkerPoll(__reg("a6") LIBRARY_BASE_TYPE *base,
                    __reg("a0") struct QJSWorker *worker);
long QJS_WorkerJoin(__reg("a6") LIBRARY_BASE_TYPE *base,
                    __reg("a0") struct QJSWorker *worker);
void QJS_WorkerDestroy(__reg("a6") LIBRARY_BASE_TYPE *base,
                       __reg("a0") struct QJSWorker *worker);
struct Library *QJS_WorkerGetBase(__reg("a6") LIBRARY_BASE_TYPE *base,
                                  __reg("a0") struct QJSWorker *worker,
                                  __reg("d0") unsigned long which);

/* W7 — networking capability probe + qjs:net module registration */
ULONG QJS_GetNetCapabilities(__reg("a6") LIBRARY_BASE_TYPE *base);
void *QJS_InitModuleNet(__reg("a6") LIBRARY_BASE_TYPE *base,
                        __reg("a0") struct JSContext *ctx,
                        __reg("a1") const char *module_name);

/* Expose already-opened math library bases so CLI/clients never
 * re-open them (architecture rule: all library management in the library).
 * which: 0=mathieeedoubbas, 1=mathieeedoubtrans, 2=mathieeesingbas. */
struct Library *QJS_GetMathBase(__reg("a6") LIBRARY_BASE_TYPE *base,
                                __reg("d0") unsigned long which);

/* D5 — install native spawnSync on globalThis.__qjs_spawnSync.
 * extended.js's child-process manifest wraps that in a Node API.
 * Called once from the CLI after context creation; no-op if called
 * twice (just replaces the global). */
void QJS_InstallChildProcessGlobal(__reg("a6") LIBRARY_BASE_TYPE *base,
                                   __reg("a0") struct JSContext *ctx);

/* E1 — install native hash + random on globalThis.
 * __qjs_cryptoDigest(alg, bytes) -> ArrayBuffer
 * __qjs_cryptoRandom(view)       -> fills view with pseudo-random bytes
 * extended.js wraps in WebCrypto shape (crypto.subtle.digest + getRandomValues). */
void QJS_InstallCryptoGlobal(__reg("a6") LIBRARY_BASE_TYPE *base,
                             __reg("a0") struct JSContext *ctx);

/* Q1 — install native Amiga FFI primitives on globalThis.
 * __qjs_amiga_openLibrary(name, ver)  -> lib handle
 * __qjs_amiga_closeLibrary(lib)       -> void
 * __qjs_amiga_call(lib, lvo, regs)    -> d0 via asm trampoline
 * __qjs_amiga_peek8/16/32/poke8/16/32 -> raw memory access
 * __qjs_amiga_peekString/pokeString   -> NUL-terminated ASCII
 * __qjs_amiga_allocMem/freeMem        -> exec MEMF_* allocation
 * __qjs_amiga_makeTags                -> TagItem array builder
 * extended.js wraps in globalThis.amiga with LVO constant tables. */
void QJS_InstallAmigaFFIGlobal(__reg("a6") LIBRARY_BASE_TYPE *base,
                               __reg("a0") struct JSContext *ctx);

/* EvalSimple: evaluate JS, return int32 result. -9999 on exception. */
long QJS_EvalSimple(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") struct JSContext *ctx,
    __reg("a1") const char *input,
    __reg("d0") ULONG input_len);

/* Full Eval with JSValue output pointer */
void QJS_Eval(
    __reg("a6") LIBRARY_BASE_TYPE *base,
    __reg("a0") JSValue *result,
    __reg("a1") struct JSContext *ctx,
    __reg("a2") const char *input,
    __reg("d0") ULONG input_len,
    __reg("a3") const char *filename,
    __reg("d1") int eval_flags);

/* ---- Function pointer table ---- */

#define LIBRARY_FUNCTIONS \
    (APTR) QJS_NewRuntime, \
    (APTR) QJS_FreeRuntime, \
    (APTR) QJS_NewContext, \
    (APTR) QJS_NewContextRaw, \
    (APTR) QJS_FreeContext, \
    (APTR) QJS_GetVersion, \
    (APTR) QJS_SetMemoryLimit, \
    (APTR) QJS_SetMaxStackSize, \
    (APTR) QJS_RunGC, \
    (APTR) QJS_AddBaseObjects, \
    (APTR) QJS_AddEval, \
    (APTR) QJS_AddDate, \
    (APTR) QJS_AddRegExp, \
    (APTR) QJS_AddJSON, \
    (APTR) QJS_AddProxy, \
    (APTR) QJS_AddMapSet, \
    (APTR) QJS_AddTypedArrays, \
    (APTR) QJS_AddPromise, \
    (APTR) QJS_AddWeakRef, \
    (APTR) QJS_AddDOMException, \
    (APTR) QJS_AddPerformance, \
    (APTR) QJS_EvalSimple, \
    (APTR) QJS_Eval, \
    (APTR) QJS_SetRuntimeInfo, \
    (APTR) QJS_GetRuntimeOpaque, \
    (APTR) QJS_SetRuntimeOpaque, \
    (APTR) QJS_UpdateStackTop, \
    (APTR) QJS_SetDumpFlags, \
    (APTR) QJS_GetDumpFlags, \
    (APTR) QJS_GetGCThreshold, \
    (APTR) QJS_SetGCThreshold, \
    (APTR) QJS_IsLiveObject, \
    (APTR) QJS_DupContext, \
    (APTR) QJS_GetContextOpaque, \
    (APTR) QJS_SetContextOpaque, \
    (APTR) QJS_GetRuntime, \
    (APTR) QJS_SetClassProto, \
    (APTR) QJS_GetClassProto, \
    (APTR) QJS_GetFunctionProto, \
    (APTR) QJS_AddBigInt, \
    (APTR) QJS_AddRegExpCompiler, \
    (APTR) QJS_IsEqual, \
    (APTR) QJS_IsStrictEqual, \
    (APTR) QJS_IsSameValue, \
    (APTR) QJS_IsSameValueZero, \
    (APTR) QJS_ComputeMemoryUsage, \
    (APTR) QJS_AddRuntimeFinalizer, \
    (APTR) QJS_FreeValue, \
    (APTR) QJS_FreeValueRT, \
    (APTR) QJS_DupValue, \
    (APTR) QJS_DupValueRT, \
    (APTR) QJS_NewNumber, \
    (APTR) QJS_NewBigInt64, \
    (APTR) QJS_NewBigUint64, \
    (APTR) QJS_NewStringLen, \
    (APTR) QJS_NewAtomString, \
    (APTR) QJS_ToString, \
    (APTR) QJS_ToPropertyKey, \
    (APTR) QJS_ToCStringLen2, \
    (APTR) QJS_FreeCString, \
    (APTR) QJS_ToBool, \
    (APTR) QJS_ToInt32, \
    (APTR) QJS_ToInt64, \
    (APTR) QJS_ToFloat64, \
    (APTR) QJS_ToNumber, \
    (APTR) QJS_NewObject, \
    (APTR) QJS_NewObjectClass, \
    (APTR) QJS_NewObjectProto, \
    (APTR) QJS_NewArray, \
    (APTR) QJS_IsArray, \
    (APTR) QJS_IsFunction, \
    (APTR) QJS_IsConstructor, \
    (APTR) QJS_GetGlobalObject, \
    (APTR) QJS_ToObject, \
    (APTR) QJS_Throw, \
    (APTR) QJS_GetException, \
    (APTR) QJS_HasException, \
    (APTR) QJS_IsError, \
    (APTR) QJS_NewError, \
    (APTR) QJS_ThrowOutOfMemory, \
    (APTR) QJS_DetectModule, \
    (APTR) QJS_Malloc, \
    (APTR) QJS_Free, \
    (APTR) QJS_Realloc, \
    (APTR) QJS_Calloc, \
    (APTR) QJS_Mallocz, \
    (APTR) QJS_Strdup, \
    (APTR) QJS_GetProperty, \
    (APTR) QJS_GetPropertyUint32, \
    (APTR) QJS_GetPropertyStr, \
    (APTR) QJS_GetPropertyInt64, \
    (APTR) QJS_SetProperty, \
    (APTR) QJS_SetPropertyUint32, \
    (APTR) QJS_SetPropertyStr, \
    (APTR) QJS_HasProperty, \
    (APTR) QJS_DeleteProperty, \
    (APTR) QJS_SetPrototype, \
    (APTR) QJS_GetPrototype, \
    (APTR) QJS_GetLength, \
    (APTR) QJS_SetLength, \
    (APTR) QJS_IsExtensible, \
    (APTR) QJS_PreventExtensions, \
    (APTR) QJS_SealObject, \
    (APTR) QJS_FreezeObject, \
    (APTR) QJS_DefinePropertyValue, \
    (APTR) QJS_DefinePropertyValueUint32, \
    (APTR) QJS_DefinePropertyValueStr, \
    (APTR) QJS_SetOpaque, \
    (APTR) QJS_GetOpaque, \
    (APTR) QJS_GetOpaque2, \
    (APTR) QJS_GetOwnPropertyNames, \
    (APTR) QJS_FreePropertyEnum, \
    (APTR) QJS_IsInstanceOf, \
    (APTR) QJS_NewAtomLen, \
    (APTR) QJS_NewAtom, \
    (APTR) QJS_NewAtomUInt32, \
    (APTR) QJS_DupAtom, \
    (APTR) QJS_FreeAtom, \
    (APTR) QJS_AtomToValue, \
    (APTR) QJS_AtomToString, \
    (APTR) QJS_AtomToCStringLen, \
    (APTR) QJS_ValueToAtom, \
    (APTR) QJS_EvalFunction, \
    (APTR) QJS_Call, \
    (APTR) QJS_Invoke, \
    (APTR) QJS_CallConstructor, \
    (APTR) QJS_ParseJSON, \
    (APTR) QJS_JSONStringify, \
    (APTR) QJS_WriteObject, \
    (APTR) QJS_ReadObject, \
    (APTR) QJS_NewClassID, \
    (APTR) QJS_NewClass, \
    (APTR) QJS_IsRegisteredClass, \
    (APTR) QJS_GetClassID, \
    (APTR) QJS_SetModuleLoaderFunc, \
    (APTR) QJS_GetImportMeta, \
    (APTR) QJS_GetModuleName, \
    (APTR) QJS_GetModuleNamespace, \
    (APTR) QJS_NewCModule, \
    (APTR) QJS_AddModuleExport, \
    (APTR) QJS_SetModuleExport, \
    (APTR) QJS_ResolveModule, \
    (APTR) QJS_GetScriptOrModuleName, \
    (APTR) QJS_NewCFunction2, \
    (APTR) QJS_SetConstructor, \
    (APTR) QJS_SetPropertyFunctionList, \
    (APTR) QJS_IsJobPending, \
    (APTR) QJS_ExecutePendingJob, \
    (APTR) QJS_NewPromiseCapability, \
    (APTR) QJS_PromiseState, \
    (APTR) QJS_PromiseResult, \
    (APTR) QJS_IsPromise, \
    (APTR) QJS_SetInterruptHandler, \
    (APTR) QJS_SetHostPromiseRejectionTracker, \
    (APTR) QJS_SetCanBlock, \
    (APTR) QJS_NewArrayBufferCopy, \
    (APTR) QJS_GetArrayBuffer, \
    (APTR) QJS_IsArrayBuffer, \
    (APTR) QJS_DetachArrayBuffer, \
    (APTR) QJS_GetUint8Array, \
    (APTR) QJS_NewUint8ArrayCopy, \
    (APTR) QJS_IsDate, \
    (APTR) QJS_IsRegExp, \
    (APTR) QJS_IsMap, \
    (APTR) QJS_IsSet, \
    (APTR) QJS_NewSymbol, \
    (APTR) QJS_NewDate, \
    (APTR) QJS_SetIsHTMLDDA, \
    (APTR) QJS_SetConstructorBit, \
    (APTR) QJS_LoadModule, \
    (APTR) QJS_GetLibcOpaque, \
    (APTR) QJS_SetLibcOpaque, \
    (APTR) QJS_AddModuleExportList, \
    (APTR) QJS_SetModuleExportList, \
    (APTR) QJS_EvalBuf, \
    (APTR) QJS_InitModuleStd, \
    (APTR) QJS_InitModuleOS, \
    (APTR) QJS_InitModuleBJSON, \
    (APTR) QJS_StdInitHandlers, \
    (APTR) QJS_StdFreeHandlers, \
    (APTR) QJS_StdAddHelpers, \
    (APTR) QJS_StdLoop, \
    (APTR) QJS_StdEvalBinary, \
    (APTR) QJS_StdDumpError, \
    (APTR) QJS_LoadFile, \
    (APTR) QJS_SetModuleLoader, \
    (APTR) QJS_InstallExtended, \
    (APTR) QJS_WorkerSpawn, \
    (APTR) QJS_WorkerPoll, \
    (APTR) QJS_WorkerJoin, \
    (APTR) QJS_WorkerDestroy, \
    (APTR) QJS_WorkerGetBase, \
    (APTR) QJS_GetNetCapabilities, \
    (APTR) QJS_InitModuleNet, \
    (APTR) QJS_GetMathBase, \
    (APTR) QJS_InstallChildProcessGlobal, \
    (APTR) QJS_InstallCryptoGlobal, \
    (APTR) QJS_InstallAmigaFFIGlobal

#endif /* LIBRARYCONFIG_H */
