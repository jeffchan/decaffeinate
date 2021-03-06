import NodePatcher from './NodePatcher.js';
import type { Editor, Node, ParseContext } from './types.js';

/**
 * Handles spread operations, e.g. `a(b...)` or `[a...]`.
 */
export default class SpreadPatcher extends NodePatcher {
  constructor(node: Node, context: ParseContext, editor: Editor, expression: ?NodePatcher) {
    super(node, context, editor);
    this.expression = expression;
  }

  initialize() {
    this.expression.setRequiresExpression();
  }

  /**
   * All we have to do is move the `...` from the right to the left.
   */
  patchAsExpression() {
    if (this.node.virtual) {
      // i.e. the virtual spread in a bare `super` call.
      return;
    }

    // `a...` → `...a...`
    //           ^^^
    this.insert(this.expression.before, '...');
    this.expression.patch();
    // `...a...` → `...a`
    //      ^^^
    this.remove(this.expression.after, this.end);
  }
}
