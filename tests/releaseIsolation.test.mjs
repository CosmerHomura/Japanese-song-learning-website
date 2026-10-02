import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

test('production build excludes local lyrics and public audio without altering them', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'uta-release-test-'))
  try {
    await mkdir(join(fixture, 'src/data'), { recursive: true })
    await mkdir(join(fixture, 'song'))
    const privateSource = 'export const importedSongs = [{ title: "PRIVATE_LYRIC_FIXTURE" }]'
    await writeFile(join(fixture, 'src/data/songs.generated.js'), privateSource)
    await writeFile(join(fixture, 'song/private-audio.mp3'), 'PRIVATE_AUDIO_FIXTURE')
    await writeFile(join(fixture, 'index.html'), '<script type="module" src="/main.js"></script>')
    await writeFile(join(fixture, 'main.js'), "import { importedSongs } from './src/data/songs.generated.js'; window.releaseFixture = importedSongs")
    await build({ root: fixture, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'silent' })
    const outputFiles = await readdir(join(fixture, 'dist'), { recursive: true })
    assert.ok(!outputFiles.includes('private-audio.mp3'))
    const asset = outputFiles.find(name => name.endsWith('.js'))
    assert.ok(asset)
    assert.ok(!(await readFile(join(fixture, 'dist', asset), 'utf8')).includes('PRIVATE_LYRIC_FIXTURE'))
    assert.equal(await readFile(join(fixture, 'src/data/songs.generated.js'), 'utf8'), privateSource)
    assert.equal(await readFile(join(fixture, 'song/private-audio.mp3'), 'utf8'), 'PRIVATE_AUDIO_FIXTURE')
  } finally { await rm(fixture, { recursive: true, force: true }) }
})
