const test = require('node:test');
const assert = require('node:assert/strict');
const { hostingPlan } = require('../src/server');

test('plan remains free and has no subscription model fields', () => {
  assert.equal(hostingPlan.name, 'Free Forever');
  assert.equal(hostingPlan.monthlyPriceUsd, 0);
  assert.equal(Object.hasOwn(hostingPlan, 'subscription'), false);
});
