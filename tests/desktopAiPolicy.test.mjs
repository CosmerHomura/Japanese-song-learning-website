import test from 'node:test'
import assert from 'node:assert/strict'
import policy from '../desktop/aiRequestPolicy.cjs'
const { assertPaidAiRequest } = policy

test('only paid AI routes from the app origin can use the privileged bridge', () => {
  assert.doesNotThrow(() => assertPaidAiRequest('/api/ai/review-song', 'http://127.0.0.1:14731/lesson', 'http://127.0.0.1:14731'))
  assert.throws(() => assertPaidAiRequest('/api/ai/settings', 'http://127.0.0.1:14731/', 'http://127.0.0.1:14731'))
  assert.throws(() => assertPaidAiRequest('/api/ai/review-song', 'https://elsewhere.test/', 'http://127.0.0.1:14731'))
  assert.throws(() => assertPaidAiRequest('/api/ai/review-song/../settings', 'http://127.0.0.1:14731/', 'http://127.0.0.1:14731'))
})
