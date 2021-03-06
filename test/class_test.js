import check from './support/check.js';

describe('classes', () => {
  it('converts named classes without bodies', () => {
    check(`class A`, `class A {}`);
  });

  it('converts anonymous classes without bodies wrapped in parentheses', () => {
    check(`class`, `(class {});`);
  });

  it('preserves class body functions as method definitions', () => {
    check(`
      class A
        a: ->
          1
    `, `
      class A {
        a() {
          return 1;
        }
      }
    `);
    check(`
      ->
        class A
          a: ->
            1
    `, `
      (function() {
        return class A {
          a() {
            return 1;
          }
        };
      });
    `);
  });

  it('preserves anonymous subclasses', () => {
    check(`
      class extends Parent
        constructor: ->
    `, `
      (class extends Parent {
        constructor() {}
      });
    `);
  });

  it('preserves class constructors without arguments', () => {
    check(`
      class A
        constructor: ->
          @a = 1
    `, `
      class A {
        constructor() {
          this.a = 1;
        }
      }
    `);
  });

  it('preserves class constructors with arguments', () => {
    check(`
      class A
        constructor: (a) ->
          @a = a
    `, `
      class A {
        constructor(a) {
          this.a = a;
        }
      }
    `);
  });

  it('preserves class constructors extending superclasses', () => {
    check(`
      class A extends B
        constructor: ->
    `, `
      class A extends B {
        constructor() {}
      }
    `);
  });

  it('preserves class constructors extending non-identifier superclasses', () => {
    check(`
      class A extends (class B extends C)
        constructor: ->
    `, `
      class A extends (class B extends C {}) {
        constructor() {}
      }
    `);
  });

  it('turns non-method properties into prototype assignments', () => {
    check(`
      class A
        b: 1
    `, `
      class A {
        b = 1;
      }
    `);
  });

  it('creates a constructor for bound methods', () => {
    check(`
      class A
        a: =>
          1
    `, `
      class A {
        constructor() {
          this.a = this.a.bind(this);
        }

        a() {
          return 1;
        }
      }
    `);
  });

  it('handles class properties', () => {
    check(`
      class A
        setup: _.once () ->
    `, `
      class A {
        setup = _.once(function() {});
      }
    `);
  });

  it('creates a constructor for bound methods with a `super` call in extended classes', () => {
    check(`
      class A extends B
        a: =>
          1
    `, `
      class A extends B {
        constructor(...args) {
          super(...args);
          this.a = this.a.bind(this);
        }

        a() {
          return 1;
        }
      }
    `);
  });

  it('handles bound methods with parameters', () => {
    check(`
      class a
        b: (c) =>
    `, `
      class a {
        constructor() {
          this.b = this.b.bind(this);
        }

        b(c) {}
      }
    `);
  });

  it('adds to an existing constructor for bound methods', () => {
    check(`
      class A
        a: =>
          1

        constructor: ->
          2
    `, `
      class A {
        a() {
          return 1;
        }

        constructor() {
          this.a = this.a.bind(this);
          2;
        }
      }
    `);
  });

  it('adds to an existing constructor for bound methods after a `super` call', () => {
    check(`
      class A extends B
        a: =>
          1

        constructor: ->
          super()
          this.b = 2;
    `, `
      class A extends B {
        a() {
          return 1;
        }

        constructor() {
          super();
          this.a = this.a.bind(this);
          this.b = 2;
        }
      }
    `);
  });

  it('converts `super` inside non-constructor methods to a named lookup', () => {
    check(`
      class A extends B
        a: ->
          super
    `, `
      class A extends B {
        a() {
          return super.a();
        }
      }
    `);
  });

  it('converts `super` with args inside non-constructor methods to a named lookup', () => {
    check(`
      class A extends B
        a: ->
          super 1, 2
    `, `
      class A extends B {
        a() {
          return super.a(1, 2);
        }
      }
    `);
  });

  it('converts `super` inside static methods to a named lookup', () => {
    check(`
      class A extends B
        @a: ->
          super
    `, `
      class A extends B {
        static a() {
          return super.a();
        }
      }
    `);
  });

  it('converts shorthand-this static methods correctly', () => {
    check(`
      class A
        @a: ->
          1
    `, `
      class A {
        static a() {
          return 1;
        }
      }
    `);
  });

  it('converts longhand-this static methods correctly', () => {
    check(`
      class A
        this.a = ->
          1
    `, `
      class A {
        static a() {
          return 1;
        }
      }
    `);
  });

  it('converts longhand static methods correctly', () => {
    check(`
      class A
        A.a = ->
          1
    `, `
      class A {
        static a() {
          return 1;
        }
      }
    `);
  });

  it('converts member expression class names correctly', () => {
    check(`
      class A.B
        a: -> 1
    `, `
      A.B = class B {
        a() { return 1; }
      };
    `);
  });

  it('converts dynamic member expression class names correctly', () => {
    check(`
      class A[B]
        a: -> 1
    `, `
      A[B] = class {
        a() { return 1; }
      };
    `);
  });
});
