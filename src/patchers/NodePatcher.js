import PatcherError from '../utils/PatchError.js';
import adjustIndent from '../utils/adjustIndent.js';
import repeat from 'repeating';
import type { Token, SourceToken, SourceTokenListIndex, Editor, Node, ParseContext, SourceTokenList } from './types.js';
import { logger } from '../utils/debug.js';

export default class NodePatcher {
  constructor(node: Node, context: ParseContext, editor: Editor) {
    this.log = logger(this.constructor.name);

    this.node = node;
    this.context = context;
    this.editor = editor;

    this.tokens = context.tokensForNode(node);
    this.setupLocationInformation();
  }

  /**
   * Allow patcher classes to override the class used to patch their children.
   */
  static patcherClassForChildNode(/* node: Node, property: string */): ?Class<NodePatcher> {
    return null;
  }

  /**
   * Allow patcher classes that would patch a node to chose a different class.
   */
  static patcherClassOverrideForNode(/* node: Node */): ?Class<NodePatcher> {
    return null;
  }

  /**
   * @private
   */
  setupLocationInformation() {
    let { node, context } = this;

    if (node.virtual) {
      return;
    }

    /**
     * `start` and `end` is the exclusive range within the original source that
     * composes this patcher's node. For example, here's the start and end of
     * `a + b` in the expression below:
     *
     *   console.log(a + b)
     *               ^    ^
     */
    this.start = node.range[0];
    this.end = node.range[1];

    this.startTokenIndex = context.indexOfTokenAtOffset(this.start);
    this.lastTokenIndex = this.startTokenIndex + this.tokens.length - 1;

    let beforeTokenIndex = this.startTokenIndex;
    let afterTokenIndex = this.lastTokenIndex;

    for (;;) {
      let previousBeforeToken = context.tokenAtIndex(beforeTokenIndex - 1);
      let nextAfterToken = context.tokenAtIndex(afterTokenIndex + 1);

      if (!previousBeforeToken || previousBeforeToken.data !== '(') {
        break;
      }

      if (!nextAfterToken || nextAfterToken.data !== ')') {
        break;
      }

      beforeTokenIndex--;
      afterTokenIndex++;
    }

    /**
     * `before` and `after` is the same as `start` and `end` for most nodes,
     * but expands to encompass any other tokens that are not part of the AST
     * but are still logically attached to the node, for example:
     *
     *   1 * (2 + 3)
     *       ^      ^
     *
     * Above the opening parenthesis is at the `before` index and the character
     * immediately after the closing parenthesis is at the `after` index.
     */
    this.before = Math.min(this.start, context.tokenAtIndex(beforeTokenIndex).range[0]);
    this.after = Math.max(this.end, context.tokenAtIndex(afterTokenIndex).range[1]);

    this.beforeTokenIndex = beforeTokenIndex;
    this.afterTokenIndex = afterTokenIndex;
  }

  /**
   * Called when the patcher tree is complete so we can do any processing that
   * requires communication with other patchers.
   *
   * @private
   */
  initialize() {}

  /**
   * Calls methods on `editor` to transform the source code represented by
   * `node` from CoffeeScript to JavaScript. By default this method delegates
   * to other patcher methods which can be overridden individually.
   */
  patch(options={}) {
    if (this.forcedToPatchAsExpression()) {
      this.patchAsForcedExpression(options);
    } else if (this.willPatchAsExpression()) {
      this.patchAsExpression(options);
    } else {
      this.patchAsStatement(options);
    }
  }

  /**
   * Override this to patch the node as an expression.
   */
  patchAsExpression() {
    throw this.error(`'patchAsExpression' must be overridden in subclasses`);
  }

  /**
   * Override this to patch the node as a statement.
   */
  patchAsStatement() {
    throw this.error(`'patchAsStatement' must be overridden in subclasses`);
  }

  /**
   * Override this to patch the node as an expression that would not normally be
   * an expression, often by wrapping it in an immediately invoked function
   * expression (IIFE).
   */
  patchAsForcedExpression() {
    this.patchAsExpression();
  }

  /**
   * Insert content at the start of `node`'s location.
   */
  insertAtStart(content: string) {
    this.insert(this.start, content);
  }

  /**
   * Insert content at the end of `node`'s location.
   */
  insertAtEnd(content: string) {
    this.insert(this.end, content);
  }

  /**
   * Inserts content before any punctuation for this node, i.e. parentheses.
   */
  insertBefore(content: string) {
    this.insert(this.before, content);
  }

  /**
   * Inserts content after any punctuation for this node, i.e. parentheses.
   */
  insertAfter(content: string) {
    this.insert(this.after, content);
  }

  /**
   * Insert content at the specified index.
   */
  insert(index: number, content: string) {
    if (typeof index !== 'number') {
      throw new Error(
        `cannot insert ${JSON.stringify(content)} at non-numeric index ${index}`
      );
    }
    this.log(
      'INSERT',
      index,
      JSON.stringify(content),
      'BEFORE',
      JSON.stringify(this.context.source.slice(index, index + 2))
    );
    this.editor.insert(index, content);
  }

  /**
   * Replace the content between the start and end indexes with new content.
   */
  overwrite(start: number, end: number, content: string) {
    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new Error(
        `cannot overwrite non-numeric range [${start}, ${end}) ` +
        `with ${JSON.stringify(content)}`
      );
    }
    this.log(
      'OVERWRITE', `[${start}, ${end})`,
      JSON.stringify(this.context.source.slice(start, end)),
      '→', JSON.stringify(content)
    );
    this.editor.overwrite(start, end, content);
  }

  /**
   * Remove the content between the start and end indexes.
   */
  remove(start: number, end: number) {
    if (typeof start !== 'number' || typeof end !== 'number') {
      throw new Error(
        `cannot remove non-numeric range [${start}, ${end})`
      );
    }
    this.log(
      'REMOVE', `[${start}, ${end})`,
      JSON.stringify(this.context.source.slice(start, end))
    );
    this.editor.remove(start, end);
  }

  /**
   * Get the current content between the start and end indexes.
   */
  slice(start: number, end: number): string {
    return this.editor.slice(start, end);
  }

  /**
   * Determines whether this node starts with a string.
   */
  startsWith(string: string): boolean {
    return this.context.source.slice(this.start, this.start + string.length) === string;
  }

  /**
   * Determines whether this node ends with a string.
   */
  endsWith(string: string): boolean {
    return this.context.source.slice(this.end - string.length, this.end) === string;
  }

  /**
   * Tells us to force this patcher to generate an expression, or else throw.
   */
  setRequiresExpression() {
    this.setExpression(true);
  }

  /**
   * Tells us to try to patch as an expression, returning whether it can.
   */
  setExpression(force=false): boolean {
    if (force) {
      if (!this.canPatchAsExpression()) {
        throw this.error(`cannot represent ${this.node.type} as an expression`);
      }
    } else if (!this.prefersToPatchAsExpression()) {
      return false;
    }
    this._expression = true;
    return true;
  }

  /**
   * Override this to express whether the patcher prefers to be represented as
   * an expression. By default it's simply an alias for `canPatchAsExpression`.
   *
   * @protected
   */
  prefersToPatchAsExpression(): boolean {
    return this.canPatchAsExpression();
  }

  /**
   * Override this if a node cannot be represented as an expression.
   *
   * @protected
   */
  canPatchAsExpression(): boolean {
    return true;
  }

  /**
   * Gets whether this patcher is working on a statement or an expression.
   */
  willPatchAsExpression(): boolean {
    return this._expression;
  }

  /**
   * Gets whether this patcher was forced to patch its node as an expression.
   */
  forcedToPatchAsExpression(): boolean {
    return this.willPatchAsExpression() && !this.prefersToPatchAsExpression();
  }

  /**
   * Gets whether this patcher's node implicitly returns.
   */
  implicitlyReturns(): boolean {
    return this._implicitlyReturns || false;
  }

  /**
   * Causes the node to be returned from its function.
   */
  setImplicitlyReturns() {
    this._implicitlyReturns = true;
  }

  /**
   * Gets whether this patcher's node returns explicitly from its function.
   */
  explicitlyReturns(): boolean {
    return this._returns || false;
  }

  /**
   * Marks this patcher's as containing a node that explicitly returns.
   */
  setExplicitlyReturns() {
    this._returns = true;
    if (this.parent) {
      this.parent.setExplicitlyReturns();
    }
  }

  /**
   * Determines whether this patcher's node needs a semicolon after it. This
   * should be overridden in subclasses as appropriate.
   */
  statementNeedsSemicolon(): boolean {
    return true;
  }

  /**
   * Gets the tokens for the whole program.
   */
  getProgramSourceTokens(): SourceTokenList {
    return this.parent.getProgramSourceTokens();
  }

  /**
   * Gets the index of the token starting at a particular source index.
   */
  indexOfSourceTokenStartingAtSourceIndex(index: number): ?SourceTokenListIndex {
    return this.getProgramSourceTokens().indexOfTokenStartingAtSourceIndex(index);
  }

  /**
   * Gets the index of the token between left and right patchers that matches
   * a predicate function.
   */
  indexOfSourceTokenBetweenPatchersMatching(left: NodePatcher, right: NodePatcher, predicate: (token: SourceToken) => boolean): ?SourceTokenListIndex {
    let start = left.after;
    let end = right.before;
    return this.getProgramSourceTokens().indexOfTokenMatchingPredicate(token => {
      return (
        token.start >= start &&
        token.start <= end &&
        predicate(token)
      );
    });
  }

  /**
   * Gets the token at a particular index.
   */
  sourceTokenAtIndex(index: SourceTokenListIndex): ?SourceToken {
    return this.getProgramSourceTokens().tokenAtIndex(index);
  }

  /**
   * Gets a token between left and right patchers' nodes matching type and data.
   */
  tokenBetweenPatchersMatching(left: NodePatcher, right: NodePatcher, type: string, data: ?string=null): ?Token {
    let tokens = this.context.tokensBetweenNodes(left.node, right.node);
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      if (token.type === type && (data === null || token.data === data)) {
        return token;
      }
    }
    return null;
  }

  /**
   * Determines whether this patcher's node is preceded by a particular token.
   * Note that this looks at the token immediately before the `before` offset.
   */
  hasTokenBefore(type: string, data: ?string=null): boolean {
    return this.hasTokenAtIndex(this.beforeTokenIndex - 1, type, data);
  }

  /**
   * Determines whether this patcher's node is preceded by a particular token.
   * Note that this looks at the token immediately after the `after` offset.
   */
  hasTokenAfter(type: string, data: ?string=null): boolean {
    return this.hasTokenAtIndex(this.afterTokenIndex + 1, type, data);
  }

  /**
   * Determines whether the token at index matches.
   */
  hasTokenAtIndex(index: number, type: string, data: ?string=null): boolean {
    let token = this.context.tokenAtIndex(index);
    if (!token) {
      return false;
    }
    if (token.type !== type) {
      return false;
    }
    if (data !== null) {
      return token.data === data;
    }
    return true;
  }

  /**
   * Determines whether a token is followed by another token.
   */
  hasTokenAfterToken(token: Token, type: string, data: ?string=null): boolean {
    return this.hasTokenAtIndex(this.context.tokens.indexOf(token) + 1, type, data);
  }

  /**
   * Determines whether this patcher's node is surrounded by parentheses.
   */
  isSurroundedByParentheses(): boolean {
    let beforeToken = this.context.tokenAtIndex(this.beforeTokenIndex);
    let afterToken = this.context.tokenAtIndex(this.afterTokenIndex);
    return (
      beforeToken && beforeToken.data === '(' &&
      afterToken && afterToken.data === ')'
    );
  }

  /**
   * Negates this patcher's node when patching.
   */
  negate() {
    this.insertBefore('!');
  }

  /**
   * Gets the indent string for the line that starts this patcher's node.
   */
  getIndent(offset: number=0): string {
    return adjustIndent(this.context.source, this.start, offset);
  }

  /**
   * Gets the indent string used for each indent in this program.
   */
  getProgramIndentString(): string {
    return this.parent.getProgramIndentString();
  }

  /**
   * Indent this node a number of times. To unindent, pass a negative number.
   *
   * Note that because this method inserts indents immediately before the first
   * non-whitespace character of each line in the node's source, it should be
   * called *before* any other editing is done to the node's source to ensure
   * that strings inserted before child nodes appear after the indent, not
   * before.
   */
  indent(offset: number=1) {
    if (offset === 0) {
      return;
    }

    let indentString = this.getProgramIndentString();
    let indentToChange = repeat(indentString, Math.abs(offset));
    let start = this.before;
    let end = this.after;
    let { source } = this.context;
    let hasIndentedThisLine = false;

    for (let i = start; i < end; i++) {
      switch (source[i]) {
        case '\n':
        case '\r':
          hasIndentedThisLine = false;
          break;

        case ' ':
        case '\t':
          break;

        default:
          if (!hasIndentedThisLine) {
            if (offset > 0) {
              this.insert(i, indentToChange);
            } else if (source.slice(i - indentToChange.length, i) === indentToChange) {
              this.remove(i - indentToChange.length, i);
            } else {
              throw this.error(
                `cannot unindent line by ${offset} without enough indent`,
                i - indentToChange.length,
                i
              );
            }
            hasIndentedThisLine = true;
          }
          break;
      }
    }
  }

  /**
   * Gets the index ending the line following this patcher's node.
   *
   * @private
   */
  getEndOfLine(): number {
    let { source } = this.context;
    for (let i = this.after - '\n'.length; i < source.length; i++) {
      if (source[i] === '\n') {
        return i;
      }
    }
    return source.length;
  }

  /**
   * Appends the given content after the end of the current line.
   */
  appendLineAfter(content: string, indentOffset: number=0) {
    let eol = this.getEndOfLine();
    this.insert(eol, `\n${this.getIndent(indentOffset)}${content}`);
  }

  /**
   * Generate an error referring to a particular section of the source.
   */
  error(message: string, start: number=this.start, end: number=this.end): PatcherError {
    return new PatcherError(message, this, start, end);
  }

  /**
   * Register a helper to be reused in several places.
   */
  registerHelper(name: string, code: string): string {
    return this.parent.registerHelper(name, code);
  }

  /**
   * Determines whether this node can be repeated without side-effects. Most
   * nodes are not repeatable, so that is the default. Subclasses should
   * override this to indicate whether they are repeatable without any changes.
   */
  isRepeatable(): boolean {
    return false;
  }

  /**
   * Alter this node to enable it to be repeated without side-effects. Though
   * a default implementation is provided, subclasses should override this to
   * provide a more appropriate version for their particular node type.
   */
  makeRepeatable(parens: boolean, ref: ?string=null): string {
    if (this.isRepeatable()) {
      // If we can repeat it, just return the original source.
      return this.context.source.slice(this.start, this.end);
    } else {
      // Can't repeat it, so we assign it to a free variable and return that,
      // i.e. `a + b` → `(ref = a + b)`.
      if (parens) {
        this.insertBefore('(');
      }
      ref = this.claimFreeBinding(ref);
      this.insertBefore(`${ref} = `);
      if (parens) {
        this.insertAfter(')');
      }
      return ref;
    }
  }

  claimFreeBinding(ref: string|Array<string>='ref'): string {
    return this.node.scope.claimFreeBinding(this.node, ref);
  }
}
