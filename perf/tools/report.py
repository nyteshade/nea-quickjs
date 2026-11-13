#!/usr/bin/env python3
"""usage: report.py <prof> <funcs> [--base <prof-of-empty.js>] [--top N]
Symbolise a hook.c profile. With --base, subtracts the empty-script profile
(per function) so only the benchmark's own work remains."""
import sys, json, re, bisect, collections
args = sys.argv[1:]
top = 25; base = None
if '--top' in args: i = args.index('--top'); top = int(args[i+1]); del args[i:i+2]
if '--base' in args: i = args.index('--base'); base = args[i+1]; del args[i:i+2]
prof, funcs = args[:2]

F = []; S = []
for l in open(funcs):
    p = l.split()
    if p[0] == 'F': F.append((int(p[1], 16), p[2], p[3]))
    else: S.append((int(p[1], 16), int(p[2], 16), p[3]))
F.sort(); faddr = [a for a, _, _ in F]
codeend = max(e for _, e, _ in S)

CATS = [
 ('interp: JS_CallInternal (self)', r'^JS_CallInternal$'),
 ('interp: call glue', r'^(JS_Call|JS_CallFree|js_call_c_function|js_call_bound_function|JS_CallConstructor.*|js_closure2?|js_build_arguments|js_build_rest|async_func_.*|js_function_apply|JS_Invoke|js_create_function.*|JS_GetFunctionRealm|js_function_proto.*)$'),
 ('property/shape lookup', r'^(find_own_property1?|JS_GetProperty.*|JS_SetProperty.*|JS_GetOwnProperty.*|JS_DefineProperty.*|JS_DefineObject.*|JS_HasProperty|add_property|add_shape_property|js_shape_.*|find_hashed_shape.*|js_new_shape.*|js_clone_shape|resize_properties|JS_CreateProperty|JS_GetGlobalVar.*|JS_SetGlobalVar.*|JS_CheckGlobalVar|JS_DefineGlobal.*|js_get_fast_array.*|JS_GetTypedArray.*|js_get_length.*|set_array_length|expand_fast_array|add_fast_array_element|convert_fast_array.*|js_allocate_fast_array|delete_property|JS_DeleteProperty.*|js_update_property_flags|JS_NewObjectFromShape|JS_NewObject.*|JS_NewArray|js_create_array.*|js_create_from_ctor|js_dup_shape|js_free_shape.*|get_shape_.*|shape_.*|JS_GetPrototype.*|js_define.*|JS_DefinePrivate.*|js_instantiate_prototype|JS_InstantiateFunctionListItem.*|JS_SetPropertyFunctionList|JS_NewCFunction.*|JS_GetOwnPropertyNames.*|js_method_set_properties|js_proxy.*|js_array_lookup|js_get_array_el.*|js_op_define.*|JS_ToPropertyKey|set_value|JS_SetConstructor.*|js_create_array_iterator|js_array_push|js_array_.*)$'),
 ('atoms & strings', r'^(JS_NewAtom.*|__JS_NewAtom.*|__JS_AtomTo.*|JS_AtomTo.*|__JS_FindAtom|JS_FreeAtom.*|__JS_AtomIsConst|JS_AtomIs.*|js_atom.*|JS_ResizeAtomHash|hash_string.*|js_string.*|JS_NewString.*|js_new_string.*|JS_ConcatString.*|JS_ConcatStrings|JS_ConcatString3|string_buffer.*|js_alloc_string.*|JS_ToString.*|JS_ToCString.*|js_sub_string|JS_NewRope.*|js_rope.*|js_linearize.*|JS_AtomGetStr.*|atom_.*|js_concat.*|JS_ToStringCheckObject|js_dtoa.*|js_ecvt.*|js_fcvt.*|u.*toa.*|js_number_to.*|JS_NewStringLen|js_strlen|js_get_atom_index|js_free_atom.*|JS_DupAtom|JS_ConcatStringInplace|js_utf.*|utf8_.*)$'),
 ('alloc (js_malloc..pool)', r'^(js_malloc.*|js_mallocz.*|js_realloc.*|js_free|js_free_rt|js_def_.*|js_strn?dup|js_trigger_gc|js_realloc2|js_array_realloc|js_resize_array|dbuf_.*|sharedlib_.*alloc.*|sharedlib_free|malloc|free|realloc|calloc|.*malloc_usable.*)$'),
 ('GC & free', r'^(__JS_FreeValue.*|JS_FreeValue.*|free_.*|JS_RunGC|gc_.*|mark_children|JS_MarkValue|js_.*_mark|js_.*_finalizer|JS_FreeContext|JS_FreeRuntime|free_zero_refcount|add_gc_object|remove_gc_object|js_weakref.*|reset_weak_ref|is_live|JS_MarkContext|js_free_value.*|close_var_refs|js_array_finalizer|js_bytecode_function.*|js_free_function_def|js_autoinit_free|free_property)$'),
 ('number conv/arith helpers', r'^(js_binary_arith.*|js_add_slow|js_unary_arith.*|js_post_inc_slow|js_binary_logic.*|js_shr_slow|js_relational.*|js_strict_eq.*|js_eq_slow|js_same_value.*|JS_ToInt32.*|JS_ToUint32.*|JS_ToFloat64.*|JS_ToNumber.*|JS_ToInt64.*|JS_ToNumeric.*|JS_ToBool.*|__JS_NewFloat64|JS_NewFloat64|js_number|js_int.*|js_float64|JS_ToPrimitive.*|JS_ToArrayLengthFree|JS_NumberIsInteger|js_fmod|js_pow|js_math_.*|JS_ToInt32Clamp|JS_ToInt32Sat|JS_ToArrayIndex|JS_NewInt.*|JS_NewBigInt.*|JS_NewUint32|js_dbl.*|float64_.*|js_bigint.*|JS_IsEqual|JS_ToIndex)$'),
 ('bytecode reader', r'^(JS_ReadObject.*|JS_Read[A-Z].*|bc_read.*|bc_get.*|bc_idx_to_atom|JS_ReadFunction.*|JS_ReadString|JS_ReadModule|JS_ReadSharedArrayBuffer|bc_reader_free|js_inner_module.*|js_create_module.*|JS_EvalFunction.*|JS_EvalObject|js_link_module|js_execute.*module.*|JS_EvalThis.*|js_build_module_ns|js_resolve.*|js_host_resolve.*|js_get_module_ns|js_dynamic_import.*|resolve_.*|js_new_module_def|add_export.*|add_req_module|add_star_export_entry|js_evaluate_module|js_find_loaded_module|js_create_module_function|js_create_module_var|js_create_module_bytecode_function|JS_ResolveModule|exported_names.*|get_exported_names|JS_LoadModule.*|js_load_module.*|js_inner_module_linking|js_inner_module_evaluation|js_execute_sync_module)$'),
 ('runtime/context init', r'^(JS_NewRuntime.*|JS_NewContext.*|JS_AddIntrinsic.*|JS_NewGlobalCConstructor.*|JS_InitAtoms|JS_NewClass.*|JS_NewClassID|init_class_range|JS_NewSymbol.*|js_new_std.*|js_init_module.*|js_std_.*init.*|js_os_.*init.*|JS_AddModuleExport.*|JS_SetModuleExport.*|JS_NewCModule|JS_NewObjectProtoClass|JS_SetOpaque.*)$'),
 ('parser/compiler', r'^(js_parse.*|next_token|emit_.*|resolve_scope.*|resolve_variables|resolve_labels|js_create_function|skip_dead_code|code_has_label|find_jump_target|push_scope|pop_scope|add_var|add_arg|cpool_add|js_new_function_def|__JS_EvalInternal|JS_EvalInternal|JS_Eval.*|ident_realloc|parse_ident|json_.*|js_parse_.*|lre_.*parse.*|template.*|add_closure_var|get_closure_var.*|optimize_.*|ss_check|compute_stack_size|update_label|new_label.*|instantiate_hoisted_definitions|add_scope_var|find_var.*|find_arg|find_lexical.*|peek_token|token_.*|js_is_live_code|is_let|set_object_name.*|lvalue.*|put_lvalue|get_lvalue|js_define_var|push_break_entry|pop_break_entry|emit_goto|close_scopes|add_pc2line.*|compute_pc2line.*|free_token|js_emit.*|set_eval_ret_undefined|add_eval_variables|mark_eval_captured.*|js_parse_.*)$'),
]
CRE = [(n, re.compile(r)) for n, r in CATS]
FILECAT = [
 (r'^sharedlib_mem\.c$', 'alloc (js_malloc..pool)'),
 (r'^sharedlib_(string|clib|stdio|posix|printf|strtod|time|vbcc|fetch|worker)\.c$', 'own libc (sharedlib_*.c)'),
 (r'^sharedlib_int64(_soft)?\.s$|^sharedlib_int64_conv\.c$', 'int64 helpers'),
 (r'^sharedlib_math(_soft|_fpu_aux)?\.c$|^sharedlib_dbl_helpers\.c$', 'float glue (sharedlib_math*)'),
 (r'^libregexp\.c$', 'regexp engine (libregexp.c)'),
 (r'^libunicode\.c$', 'unicode (libunicode.c)'),
 (r'^dtoa\.c$', 'dtoa.c'),
 (r'^(quickjs_libc_lib|amiga_ffi|qjsfuncs|execinline|library|amiga_ssl_lib)\.c$|^(qjsfuncs_asm_all|amiga_ffi_call|amiga_boopsi_call)\.s$', 'libc module/LVO glue/FFI'),
 (r'^(extended|ffi)\.c$', 'bytecode arrays (data)'),
]
def cat_of(name, fil):
    for pat, c in FILECAT:
        if re.match(pat, fil): return c
    if fil == 'quickjs.c':
        for n, r in CRE:
            if r.match(name): return n
        return 'other quickjs.c'
    return 'other'

def load(prof):
    segs = json.load(open(prof + '.segs'))
    libbase = None; others = []
    for s in segs:
        if s['file'] == 'quickjs.library': libbase = s['addrs'][0]
        else:
            for a in s['addrs']: others.append((a, s['file']))
    others.sort()
    self_ = collections.Counter(); calls = {}; incl = {}; total = 0
    for l in open(prof):
        p = l.split()
        if p[0] == 'total': total = int(p[1])
        elif p[0] == 'F':
            calls[int(p[1])] = int(p[2]); incl[int(p[1])] = int(p[3])
        elif p[0] == 'P':
            pc = int(p[1], 16); n = int(p[2])
            if libbase is not None and libbase <= pc < libbase + codeend:
                i = bisect.bisect_right(faddr, pc - libbase) - 1
                self_[i] += n
            else:
                # which other segment?
                key = 'OS traps / vamos stubs'
                j = bisect.bisect_right([a for a, _ in others], pc) - 1
                if j >= 0 and pc - others[j][0] < 0x40000: key = 'seg:' + others[j][1]
                self_[key] += n
    return total, self_, calls, incl

total, self_, calls, incl = load(prof)
if base:
    bt, bs, bc, bi = load(base)
    total -= bt
    for k in bs: self_[k] -= bs[k]
    for k in bc: calls[k] = calls.get(k, 0) - bc[k]
    for k in bi: incl[k] = incl.get(k, 0) - bi[k]
def nm(k): return k if isinstance(k, str) else F[k][1]
def fl(k): return '' if isinstance(k, str) else F[k][2]
cats = collections.Counter()
for k, n in self_.items():
    if isinstance(k, str):
        c = 'CLI executable (qjs)' if k == 'seg:qjs' else ('mathieeedoubbas.library (native 68k)' if 'mathieee' in k else 'OS traps / vamos stubs')
    else: c = cat_of(F[k][1], F[k][2])
    cats[c] += n
print('profile: %s%s' % (prof.split('/')[-1], '  (minus %s)' % base.split('/')[-1] if base else ''))
print('total instructions: %d' % total)
print('\n-- by category (self instructions) --')
for c, n in cats.most_common():
    if n: print('%6.2f%%  %12d  %s' % (100.0 * n / total, n, c))
print('\n-- top %d functions by self --' % top)
print('  self%        self      calls   instr/call(incl)  name [file] {category}')
for k, n in self_.most_common(top):
    c = calls.get(k, 0) if not isinstance(k, str) else 0
    ic = incl.get(k, 0) if not isinstance(k, str) else 0
    print('%6.2f%% %11d %10d %10s  %s [%s] {%s}' % (100.0 * n / total, n, c, ('%.0f' % (ic / c)) if c > 0 else '-', nm(k), fl(k), '' if isinstance(k, str) else cat_of(F[k][1], F[k][2])))
if '--incl' in sys.argv or True:
    print('\n-- top %d by inclusive (outermost activation) --' % top)
    for k, n in sorted(incl.items(), key=lambda x: -x[1])[:top]:
        print('%6.2f%% %11d %10d  %s' % (100.0 * n / total, n, calls.get(k, 0), F[k][1]))
