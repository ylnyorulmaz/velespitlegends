const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');

describe('API meta routes', () => {
  let app;

  before(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('GET /health', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api/tactics', async () => {
    const res = await request(app).get('/api/tactics');
    assert.equal(res.status, 200);
    assert.ok(res.body.balanced);
  });

  it('GET /api/roles', async () => {
    const res = await request(app).get('/api/roles');
    assert.equal(res.status, 200);
    assert.ok(res.body.leader);
  });
});
