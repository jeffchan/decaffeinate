import BinaryOpPatcher from './BinaryOpPatcher.js';

export default class FloorDivideOpPatcher extends BinaryOpPatcher {
  /**
   * LEFT '//' RIGHT
   */
  patchAsExpression() {
    let operator = this.getOperatorToken();
    // `a // b` → `Math.floor(a // b`
    //             ^^^^^^^^^^^
    this.insertBefore('Math.floor(');

    // Patch LEFT and RIGHT.
    super.patchAsExpression();

    // `Math.floor(a // b` → `Math.floor(a // b)`
    //                                         ^
    this.insertAfter(')');
    // `Math.floor(a // b)` → `Math.floor(a / b)`
    //               ^^                     ^
    this.overwrite(...operator.range, '/');
  }
}
