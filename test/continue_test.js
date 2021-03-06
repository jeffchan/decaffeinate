import check from './support/check.js';

describe.skip('continue', () => {
  it('is passed through as-is', () => {
    check(`
      for a in b
        continue
    `, `
      for (var i = 0, a; i < b.length; i++) {
        a = b[i];
        continue;
      }
    `);
  });
});
