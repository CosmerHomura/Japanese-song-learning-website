import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_AI_SETTINGS, loadAiSettings, saveAiSettings, clearAiSettings, aiRequestHeaders } from '../src/lib/aiSettings.js'
import { BACKUP_STORAGE_KEYS } from '../src/lib/learningBackup.js'

function store() {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key), data }
}
function reset() { globalThis.localStorage = store(); globalThis.sessionStorage = store() }

test('server default does not send a browser credential', () => {
  reset()
  assert.deepEqual(aiRequestHeaders(), {})
})
test('key defaults to session storage and never enters configuration metadata or backup keys', () => {
  reset()
  saveAiSettings({ ...DEFAULT_AI_SETTINGS, useServerDefault: false, api_key: 'private-test-key' })
  assert.equal(loadAiSettings().api_key, 'private-test-key')
  assert.ok([...sessionStorage.data.values()].includes('private-test-key'))
  assert.ok(!JSON.stringify([...localStorage.data]).includes('private-test-key'))
  assert.ok(!Object.values(BACKUP_STORAGE_KEYS).includes('uta-ai-key-v1'))
})
test('remember opt-in, reversal, and clear remove keys from the previous store', () => {
  reset()
  saveAiSettings({ ...DEFAULT_AI_SETTINGS, useServerDefault: false, rememberKey: true, api_key: 'private-test-key' })
  assert.equal(localStorage.getItem('uta-ai-key-v1'), 'private-test-key')
  saveAiSettings({ ...loadAiSettings(), rememberKey: false })
  assert.equal(localStorage.getItem('uta-ai-key-v1'), null)
  assert.equal(sessionStorage.getItem('uta-ai-key-v1'), 'private-test-key')
  clearAiSettings()
  assert.equal(loadAiSettings().api_key, '')
  assert.equal(sessionStorage.getItem('uta-ai-key-v1'), null)
})
test('headers preserve Unicode names and explicit empty keys for local services', () => {
  reset()
  const headers = aiRequestHeaders({ ...DEFAULT_AI_SETTINGS, useServerDefault: false, name: '本地模型', api_key: '' })
  assert.match(headers['X-UTA-AI-Config'], /^[\x00-\x7f]+$/)
  const data = JSON.parse(decodeURIComponent(headers['X-UTA-AI-Config']))
  assert.equal(data.name, '本地模型')
  assert.equal(data.api_key, '')
})
