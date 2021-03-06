import NodePatcher from './NodePatcher.js';
import type { Editor, Node, ParseContext } from './types.js';

export default class PassthroughPatcher extends NodePatcher {
  constructor(node: Node, context: ParseContext, editor: Editor, ...children: Array<?NodePatcher|Array<?NodePatcher>>) {
    super(node, context, editor);
    this.children = children;
  }

  patch() {
    this.children.forEach(child => {
      if (Array.isArray(child)) {
        child.forEach(child => child && child.patch());
      } else if (child) {
        child.patch();
      }
    });
  }

  isRepeatable(): boolean {
    return true;
  }
}
