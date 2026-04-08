/* test_inspect.js — Verify Symbol.for('qjs.inspect') REPL display
 *
 * In the REPL, evaluating `obj` should call obj[Symbol.for('qjs.inspect')]()
 * and display the returned string instead of the default object format.
 *
 * Run: qjs (interactive), then paste the lines below.
 */

const inspectSym = Symbol.for('qjs.inspect');

class Money {
    constructor(amount, currency) {
        this.amount = amount;
        this.currency = currency;
    }
}
Money.prototype[inspectSym] = function() {
    return `${this.currency}${this.amount.toFixed(2)}`;
};

const price = new Money(42.50, '$');

/* In the REPL, type:  price
 * Should display:  $42.50
 *
 * Without the qjs.inspect feature, it would display:
 *   Money { amount: 42.5, currency: '$' }
 */

print('price object:', price);  /* prints default repr via print() */
print('inspect result:', price[inspectSym]());  /* prints "$42.50" */
print('In REPL, type "price" — should show: $42.50');
