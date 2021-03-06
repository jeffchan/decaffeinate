import UnaryOpPatcher from './UnaryOpPatcher.js';
import type { Node, ParseContext, Editor, NodePatcher } from './types.js';

/**
 * Handles unary exists, e.g. `a?`.
 */
export default class UnaryExistsOpPatcher extends UnaryOpPatcher {
  constructor(node: Node, context: ParseContext, editor: Editor, expression: NodePatcher) {
    super(node, context, editor, expression);
    this.negated = false;
  }

  /**
   * The expression version of this sometimes needs parentheses, but we don't
   * yet have a good mechanism for determining when that is, so we just make
   * sure they're always there. For example, this doesn't need parentheses:
   *
   *   set = a?
   *
   * Because it becomes this:
   *
   *   var set = typeof a !== 'undefined' && a !== null;
   *
   * But this does:
   *
   *   'set? ' + a?
   *
   * Because this:
   *
   *   'set? ' + a != null;
   *
   * Is equivalent to this:
   *
   *   ('set? + a) != null;
   *
   * Which has a different meaning than this:
   *
   *   'set? ' + (a != null);
   */
  patchAsExpression() {
    let needsParens = !this.isSurroundedByParentheses();
    if (needsParens) {
      // `a?` → `(a?`
      //         ^
      this.insertBefore('(');
    }
    this.patchAsStatement();
    if (needsParens) {
      // `(a?` → `(a?)`
      //             ^
      this.insertAfter(')');
    }
  }

  /**
   * EXPRESSION '?'
   */
  patchAsStatement() {
    let { node, negated } = this;
    let nodeExpression = node.expression;
    let needsTypeofCheck = (
      nodeExpression &&
      nodeExpression.type === 'Identifier' &&
      !node.scope.hasBinding(nodeExpression.data)
    );

    if (needsTypeofCheck) {
      if (negated) {
        // `a?` → `typeof a === 'undefined' && a === null`
        //  ^^     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        this.overwrite(
          this.start,
          this.end,
          `typeof ${nodeExpression.raw} === 'undefined' || ${nodeExpression.raw} === null`
        );
      } else {
        // `a?` → `typeof a !== 'undefined' && a !== null`
        //  ^^     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        this.overwrite(
          this.start,
          this.end,
          `typeof ${nodeExpression.raw} !== 'undefined' && ${nodeExpression.raw} !== null`
        );
      }

    } else {
      if (negated) {
        // `a.b?` → `a.b == null`
        //     ^        ^^^^^^^^
        this.overwrite(this.expression.after, this.end, ' == null');
      } else {
        // `a.b?` → `a.b != null`
        //     ^        ^^^^^^^^
        this.overwrite(this.expression.after, this.end, ' != null');
      }
    }
  }

  /**
   * Flips negated flag but doesn't edit anything immediately so that we can
   * use the correct operator in `patch`.
   */
  negate() {
    this.negated = !this.negated;
  }
}
