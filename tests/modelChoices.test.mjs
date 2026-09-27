import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modelChoices, modelLabel } from '../src/lib/modelChoices.mjs'

test('short names do not repeat the provider or API identifier', () => {
  assert.equal(modelLabel({ id: 'deepseek-flash', name: 'DeepSeek: DeepSeek V4.1 Flash' }), 'DeepSeek V4.1 Flash')
})

test('default list omits experimental, batch and pinned snapshots but retains selection', () => {
  const models = ['stable', 'stable-0324', 'stable-exp', 'stable-batch', 'stable-distill'].map(id => ({ id, name: id }))
  assert.deepEqual(modelChoices(models, '').map(model => model.id), ['stable'])
  assert.deepEqual(modelChoices(models, 'stable-exp').map(model => model.id), ['stable-exp', 'stable'])
  assert.equal(modelChoices(models, '', true).length, 5)
})

test('search includes hidden models and preserves distinct API ids', () => {
  const models = [{ id: 'first', name: 'Same' }, { id: 'second-batch', name: 'Same' }]
  assert.equal(modelChoices(models, '', false, 'batch')[0].id, 'second-batch')
  assert.equal(modelChoices(models, '', true).length, 2)
})
