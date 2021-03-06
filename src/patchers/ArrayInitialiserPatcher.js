import NodePatcher from './NodePatcher.js';
import type { Editor, Node, ParseContext } from './types.js';

export default class ArrayInitialiserPatcher extends NodePatcher {
  constructor(node: Node, context: ParseContext, editor: Editor, members: Array<NodePatcher>) {
    super(node, context, editor);
    this.members = members;
  }

  initialize() {
    this.members.forEach(member => member.setRequiresExpression());
  }

  patchAsExpression() {
    this.members.forEach((member, i, members) => {
      let isLast = i === members.length - 1;
      let needsComma = !isLast && !member.hasTokenAfter(',');
      member.patch();
      if (needsComma) {
        member.insertAfter(',');
      }
    });
  }

  patchAsStatement() {
    this.patchAsExpression();
  }
}
