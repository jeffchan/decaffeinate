import check from './support/check.js';

describe('implicit return', () => {
  it('is added for the last expression in a typical function', () => {
    check(`-> 1`, `(function() { return 1; });`);
  });

  it('is not added when one is already there', () => {
    check(`a = -> return 1`, `var a = function() { return 1; };`);
  });

  it('is not added for the last expression in a block-less bound function', () => {
    check(`=> 1`, `() => 1;`);
  });

  it('adds a return for the final expression in functions', () => {
    check(`
      ->
        1
        2
    `, `
      (function() {
        1;
        return 2;
      });
    `);
  });

  it('is added for the last expression of a block-body bound function', () => {
    check(`
      =>
        1
    `, `
      () => {
        return 1;
      };
    `);
  });

  it('is added for the last expression in a class method', () => {
    check(`
      class Foo
        a: ->
          1
    `, `
      class Foo {
        a() {
          return 1;
        }
      }
    `);
  });

  it('is not added for the last expression in a class constructor method', () => {
    check(`
      class Foo
        constructor: ->
          @a = 1
    `, `
      class Foo {
        constructor() {
          this.a = 1;
        }
      }
    `);
  });

  it('is not added for throws as the last statement', () => {
    check(`
      ->
        throw 1
    `, `
      (function() {
        throw 1;
      });
    `);

    check(`-> throw 1`, `(function() { throw 1; });`);
  });

  it('adds it outside a conditional that turns into a ternary expression', () => {
    check(`
      -> if a then b else c
    `, `
      (function() { if (a) { return b; } else { return c; } });
    `);
  });
});
