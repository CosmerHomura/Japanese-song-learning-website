# UTA · Learn Japanese through songs

<img src="public/uta-icon.png" alt="UTA app icon" width="88" />

Turn your own Japanese songs into line-by-line practice: listen, read furigana, look up words, and review what you have learned.

**Windows 10/11 x64 · Local-first · No API key required for basic features**

[Download for Windows](https://github.com/CosmerHomura/Japanese-song-learning-website/releases/latest) · [简体中文](README.md) · [Report an issue](https://github.com/CosmerHomura/Japanese-song-learning-website/issues/new/choose)

![Line-by-line learning with furigana and mastery tracking](docs/assets/lesson.png)

## A quick look

![Library, learning, word details and review walkthrough](docs/assets/walkthrough.gif)

The current interface is in Chinese, with Japanese learning content. These silent captures use original practice text and sample progress, not commercial songs or real user data. The built-in text example has no audio; import your own audio to use playback.

## Features

- Import timed LRC lyrics with MP3, M4A, WAV, OGG or WebM audio.
- Play individual lines, slow down playback, track mastery and revisit difficult sentences.
- Generate readings locally; display hiragana or romaji and optionally look up words in a Japanese–Chinese dictionary.
- Correct readings and merge or split tokens, then query the dictionary again.
- Optionally request AI help with readings, segmentation and context. Choose a provider and model, manage local keys and view estimated costs in CNY.
- Choose four themes and adjust text size and motion preferences.
- Export personal backups or `.uta-analysis` files for sharing analysis without audio, API keys or original lyric text.

## Get started

1. Open the [latest release](https://github.com/CosmerHomura/Japanese-song-learning-website/releases/latest) and install `UTA-Setup-<version>.exe`. Python and Node.js are not required. The `.blockmap` and `latest.yml` assets are for the updater.
2. Import your own audio and matching LRC file from the song library.
3. Open the learning page to listen, look up words and correct readings. Add difficult lines to review.

The installer creates a desktop shortcut. Installed builds support update checks in **设置 → 关于与更新** (Settings → About & updates), with user-confirmed download and installation. The installer is currently unsigned; Windows may display a security warning. Verify the download source.

Dictionary installation and AI setup are optional. If the recommended dictionary download is slow, obtain `tomoshi-dict-open.db.zst` from [Tomoshi releases](https://github.com/tomoshi-app/tomoshi-dict-data/releases) and import it in **设置 → 本地词典** (Settings → Local dictionary).

## FAQ

**What is LRC?** It is a timestamped lyric file, not an audio file. Current song import requires matching timestamps for line playback. Renaming a plain text file does not add timestamps.

**Do I need a paid AI account?** No for local readings, dictionary lookup and learning. Optional AI requests use your own provider key and may incur charges.

**Are automatic readings always correct?** No. Correct a word in the right sidebar or adjust token boundaries. AI suggestions also need review.

## Privacy and content

Songs and progress are stored locally. Desktop API keys use Windows current-user encryption and are excluded from learning backups. Basic annotation and dictionary lookup run locally. Requested AI analysis sends the necessary lyric context to your chosen provider; account model discovery authenticates with that provider. Public model/price catalogs do not receive your key. Remote API endpoints require HTTPS and credential-bearing requests do not follow redirects. Cover searches may send song and artist names to Apple Music. Cost estimates are not billing guarantees.

The web version's “remember key” option uses browser local storage rather than Windows encryption; avoid it on shared devices. Personal backups can contain original audio and should not be published. Release builds exclude local development songs.

UTA does not supply copyrighted songs, lyrics or audio downloads. Only import or share content you are entitled to use.

## Credits and license

Forked from [meilawiet/Japanese-song-learning-website](https://github.com/meilawiet/Japanese-song-learning-website). This fork extends the desktop and learning features and is not an official release from the upstream author.

Local annotation uses SudachiPy / SudachiDict Core. The optional Japanese–Chinese dictionary comes from Tomoshi Dictionary Open Data Layer; see [third-party data notices](THIRD_PARTY_DATA_NOTICES.md).

Source code is available under the [MIT license](LICENSE). Third-party data retains its own licensing terms.

## Feedback and development

[Report bugs or request features](https://github.com/CosmerHomura/Japanese-song-learning-website/issues/new/choose). Include your app version, reproduction steps and relevant screenshots, but never keys, complete backups or copyrighted song files.

For source setup and packaging, see the [development guide (Chinese)](docs/development.md).
