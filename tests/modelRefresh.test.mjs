import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileModelCatalog } from '../src/lib/modelRefresh.mjs'

test('background discovery keeps the current model and unsaved key', () => {
  const settings = { provider: 'deepseek', model: 'new-choice', api_key: 'test-placeholder' }
  const result = reconcileModelCatalog(settings, 'deepseek', [{ id: 'old-choice', input_price: 10 }, { id: 'new-choice', input_price: 2 }])
  assert.equal(result.model, 'new-choice')
  assert.equal(result.api_key, settings.api_key)
  assert.equal(result.input_price, 2)
})

test('stale provider results and missing selected models never reset settings', () => {
  const settings = { provider: 'other', model: 'custom-model' }
  assert.equal(reconcileModelCatalog(settings, 'deepseek', [{ id: 'custom-model' }]), settings)
  assert.equal(reconcileModelCatalog(settings, 'other', [{ id: 'default' }]), settings)
})
