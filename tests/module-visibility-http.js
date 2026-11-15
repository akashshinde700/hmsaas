/* Integration test against a locally seeded server. */
const assert = require('node:assert/strict')
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000'
async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { response, data: await response.json() }
}
async function login(email, password) {
  const result = await request('/api/auth', { method: 'POST', body: { email, password } })
  assert.equal(result.response.status, 200)
  return result.response.headers.get('set-cookie').split(';')[0]
}
async function main() {
  const admin = await login('admin@sahyadrihospitalpune.in', 'Sahyadri@123')
  const doctor = await login('ananya.kulkarni@sahyadrihospitalpune.in', 'Doctor@123')
  const other = await login('admin@arogyacarekharadi.in', 'Arogya@123')
  const endpoint = '/api/settings/module-visibility'
  const original = (await request(endpoint, { cookie: admin })).data.moduleVisibility
  try {
    assert.equal((await request(endpoint, { method: 'PATCH', body: { moduleVisibility: { rx: false } } })).response.status, 401)
    assert.equal((await request(endpoint, { cookie: doctor, method: 'PATCH', body: { moduleVisibility: { rx: false } } })).response.status, 403)
    assert.equal((await request(endpoint, { cookie: admin, method: 'PATCH', body: { moduleVisibility: { settings: false } } })).response.status, 400)
    assert.equal((await request(endpoint, { cookie: admin, method: 'PATCH', body: { moduleVisibility: { bogus: true } } })).response.status, 400)
    assert.equal((await request(endpoint, { cookie: admin, method: 'PATCH', body: { moduleVisibility: { rx: false } } })).response.status, 200)
    assert.equal((await request(endpoint, { cookie: admin })).data.moduleVisibility.rx, false)
    assert.notEqual((await request(endpoint, { cookie: other })).data.moduleVisibility.rx, false)
    assert.equal((await request(endpoint, { cookie: admin, method: 'PATCH', body: { moduleVisibility: { rx: true } } })).response.status, 200)
    assert.equal((await request(endpoint, { cookie: admin })).data.moduleVisibility.rx, true)
    console.log('Module visibility authentication, validation, persistence and tenant isolation passed.')
  } finally {
    await request(endpoint, { cookie: admin, method: 'PATCH', body: { moduleVisibility: { ...original, rx: original.rx !== false } } })
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1 })
