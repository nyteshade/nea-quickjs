/* Not valid as a module (a with statement), so it must run as a script. */
with ({ value: 'script: with statement works' }) { print(value); }
print(typeof this, this === globalThis);
