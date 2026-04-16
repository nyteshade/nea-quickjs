/* test_events.js — EventEmitter regression test. */

let pass = 0, fail = 0;
function t(label, cond) {
    if (cond) { pass++; print('  ok  ' + label); }
    else      { fail++; print('  FAIL ' + label); }
}

print('test_events: EventEmitter subset');

/* ---- basic on/emit --------------------------------------- */
{
    const e = new EventEmitter();
    let seen = null;
    e.on('hi', x => { seen = x; });
    e.emit('hi', 42);
    t('on + emit delivers', seen === 42);
}

/* ---- multiple listeners, insertion order ---------------- */
{
    const e = new EventEmitter();
    const log = [];
    e.on('x', () => log.push('a'));
    e.on('x', () => log.push('b'));
    e.emit('x');
    t('listeners fire in order', log.join(',') === 'a,b');
}

/* ---- prependListener ------------------------------------- */
{
    const e = new EventEmitter();
    const log = [];
    e.on('x', () => log.push('second'));
    e.prependListener('x', () => log.push('first'));
    e.emit('x');
    t('prependListener runs first', log.join(',') === 'first,second');
}

/* ---- once ------------------------------------------------ */
{
    const e = new EventEmitter();
    let n = 0;
    e.once('tick', () => n++);
    e.emit('tick');
    e.emit('tick');
    e.emit('tick');
    t('once fires exactly once', n === 1);
}

/* ---- off with direct reference --------------------------- */
{
    const e = new EventEmitter();
    let n = 0;
    const h = () => n++;
    e.on('x', h);
    e.emit('x');
    e.off('x', h);
    e.emit('x');
    t('off removes listener', n === 1);
}

/* ---- off on a once-wrapped listener ---------------------- */
{
    const e = new EventEmitter();
    let n = 0;
    const h = () => n++;
    e.once('x', h);
    e.off('x', h);          /* remove before firing */
    e.emit('x');
    t('off removes once-wrapped', n === 0);
}

/* ---- removeAllListeners ---------------------------------- */
{
    const e = new EventEmitter();
    let n = 0;
    e.on('x', () => n++);
    e.on('y', () => n++);
    e.removeAllListeners();
    e.emit('x'); e.emit('y');
    t('removeAllListeners clears', n === 0);
}

/* ---- error with no listener throws ----------------------- */
{
    const e = new EventEmitter();
    let threw = false;
    try { e.emit('error', new Error('boom')); } catch (_) { threw = true; }
    t('unhandled error throws', threw);
}

/* ---- error with listener absorbs ------------------------- */
{
    const e = new EventEmitter();
    let seen;
    e.on('error', err => { seen = err.message; });
    e.emit('error', new Error('caught'));
    t('error with listener absorbs', seen === 'caught');
}

/* ---- mutation during emit is isolated -------------------- */
{
    const e = new EventEmitter();
    let n = 0;
    const a = () => { n++; e.on('x', () => n += 100); };  /* adds during emit */
    e.on('x', a);
    e.emit('x');  /* should call only `a`, not the dynamically-added handler */
    t('mutation during emit snapshots', n === 1);
    e.emit('x');  /* now the added listener runs */
    t('subsequent emit sees new listener', n === 1 + 1 + 100);
}

/* ---- introspection --------------------------------------- */
{
    const e = new EventEmitter();
    const h1 = () => 0, h2 = () => 0;
    e.on('x', h1);
    e.on('x', h2);
    t('listenerCount',        e.listenerCount('x') === 2);
    t('listeners shape',      e.listeners('x').length === 2);
    t('eventNames',           e.eventNames().indexOf('x') >= 0);
    e.removeAllListeners('x');
    t('remove by name empties', e.listenerCount('x') === 0);
}

/* ---- newListener / removeListener meta-events ------------ */
{
    const e = new EventEmitter();
    const log = [];
    e.on('newListener', (ev, fn) => log.push('new:' + ev));
    e.on('removeListener', (ev, fn) => log.push('rm:' + ev));
    const h = () => 0;
    e.on('hello', h);
    e.off('hello', h);
    t('newListener meta',  log.indexOf('new:hello') >= 0);
    t('removeListener meta', log.indexOf('rm:hello') >= 0);
}

/* ---- chaining -------------------------------------------- */
{
    const e = new EventEmitter();
    const ret = e.on('x', () => 0).once('y', () => 0).setMaxListeners(5);
    t('methods return this', ret === e);
    t('setMaxListeners persists', e.getMaxListeners() === 5);
}

print('test_events: ' + pass + ' pass / ' + fail + ' fail');
