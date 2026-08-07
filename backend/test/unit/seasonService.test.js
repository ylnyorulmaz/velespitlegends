const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { weeklyWage } = require('../../services/seasonService');

describe('seasonService (pure)', () => {
  it('weeklyWage slices season salary across weeks', () => {
    assert.equal(weeklyWage(30000, 30), 1000);
    assert.equal(weeklyWage(0, 30), 0);
    assert.equal(weeklyWage(-10, 30), 0);
    // falsy totalWeeks falls back to 30
    assert.equal(weeklyWage(30000, 0), 1000);
  });

  it('weeklyWage never returns a fractional sub-1 wage for positive salary', () => {
    assert.equal(weeklyWage(10, 30), 1);
  });
});
