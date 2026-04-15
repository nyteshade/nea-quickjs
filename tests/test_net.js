/* test_net.js — exercise the qjs:net capability probe module.
 *
 * Expected behavior on an Amiga with bsdsocket.library + AmiSSL installed:
 *   hasTCP=true, hasTLS=true. On a stripped system, either bit may be 0
 *   and fetch() will throw a clear TypeError naming the missing library. */
import * as Networking from "qjs:net";

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; print("  ok  " + label); }
    else      { fail++; print("  FAIL " + label); }
}

print("test_net: qjs:net module");

const s = Networking.status();
check("status() returns object",     typeof s === "object" && s !== null);
check("status.tcp is boolean",       typeof s.tcp === "boolean");
check("status.tls is boolean",       typeof s.tls === "boolean");
check("hasTCP() matches status.tcp", Networking.hasTCP() === s.tcp);
check("hasTLS() matches status.tls", Networking.hasTLS() === s.tls);

const r = Networking.reprobe();
check("reprobe() returns object",    typeof r === "object" && r !== null);
check("reprobe.tcp === status.tcp",  r.tcp === s.tcp);
check("reprobe.tls === status.tls",  r.tls === s.tls);

print("caps: tcp=" + s.tcp + " tls=" + s.tls);
print("test_net: " + pass + " pass / " + fail + " fail");
