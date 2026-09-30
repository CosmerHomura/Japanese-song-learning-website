import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dictionaryPanelVisible } from '../src/lib/dictionaryPanel.mjs'

test('installed dictionary closes the panel even for forced status events', () => {
  assert.equal(dictionaryPanelVisible({ phase: 'ready' }, true), false)
  assert.equal(dictionaryPanelVisible({ phase: 'ready' }, true, true), false)
})
test('active downloads open the panel but dismissed terminal states stay dismissed', () => {
  assert.equal(dictionaryPanelVisible({ phase: 'downloading' }, false), true)
  assert.equal(dictionaryPanelVisible({ phase: 'cancelled' }, false), false)
  assert.equal(dictionaryPanelVisible({ phase: 'error' }, false), false)
  assert.equal(dictionaryPanelVisible({ phase: 'cancelled' }, false, true), true)
})
