# UTA · 用日语歌练习发音

UTA 是一个本地优先的日语歌曲学习应用：导入自己的歌曲音频与带时间轴的 LRC 歌词，逐句听读、查词、跟练和复习。当前桌面版面向 Windows 10/11 x64，也保留网页开发模式。

本仓库 fork 自 [meilawiet/Japanese-song-learning-website](https://github.com/meilawiet/Japanese-song-learning-website)。桌面端和新增学习功能由本 fork 扩展，并非原作者的官方发行版。

## 可以做什么

- 从歌曲库导入 LRC 与 MP3、M4A、WAV、OGG 或 WebM 音频，预览并修改歌词、时间戳、译文和封面。
- 按句播放、慢放和练习；标记已掌握或加入复习，查看歌曲与逐句学习进度。
- 本地生成假名读音，查询可选的日中词典；读音或分词不准确时可手动修正、合并或拆分，再重新查词。
- 按需使用 AI 检查读音、分词或解释语境。用户确认后才应用建议；AI 供应商、模型和本机 Key 在设置中管理，费用以人民币估算。
- 导出个人备份，或导出不含音频、API Key 和歌词正文的 `.uta-analysis` 共享解析。共享前仍需确认内容的版权与隐私。

## 开始使用

正式安装包可从 [GitHub 发布页](https://github.com/CosmerHomura/Japanese-song-learning-website/releases) 下载；若尚未发布，从源码运行或打包请看 [开发与构建说明](docs/development.md)。Windows 安装包会创建桌面快捷方式；正式安装版会在启动后检查更新，发现新版本后可在 **设置 → 关于与更新** 下载并选择重启安装。桌面版首次启动会询问是否安装推荐的 Tomoshi 日中词典；不安装也能使用基本注音。之后可在 **设置 → 本地词典** 下载、取消下载或导入兼容的本地数据库。

导入歌曲时，LRC 必须包含与音频匹配的时间戳，例如：

```lrc
[00:12.40]夏の空を見上げる
[00:16.20]君に言葉を届けたい
```

LRC 是歌词时间轴，不包含音频；普通 TXT 改名为 `.lrc` 并不会自动产生时间戳。歌曲和学习记录保存在当前应用/浏览器的本地数据中，切换设备前请在歌曲库导出个人备份。

如果推荐词典下载缓慢，可从 [Tomoshi 发布页](https://github.com/tomoshi-app/tomoshi-dict-data/releases) 手动获取 `tomoshi-dict-open.db.zst`，再通过 **设置 → 本地词典 → 上传本地词典** 导入。也支持符合应用数据表要求的 `.db`、`.sqlite`、`.sqlite3` 文件。

## 隐私与费用

歌词、音频、学习进度和本机 Key 默认保存在本机，不会作为仓库内容发布。自动注音和词典查询在本机执行；只有用户主动请求 AI 解析/校对时，所需歌词上下文才会发给所选供应商。查询封面时，歌名和歌手名可能发送给 Apple Music。AI 人民币费用是参考价格估算，最终以供应商账单为准。

项目不提供受版权保护的歌曲、歌词或音频下载。请只导入、分享你有权使用的内容；完整个人备份可能包含原始音频，不适合公开传播。

## 致谢

- 原项目：[meilawiet/Japanese-song-learning-website](https://github.com/meilawiet/Japanese-song-learning-website)。
- 日语分词与读音：SudachiPy / SudachiDict Core。
- 可选日中词典：Tomoshi Dictionary Open Data Layer；见 [第三方数据声明](THIRD_PARTY_DATA_NOTICES.md)。

开发、测试、构建和架构说明分别见 [开发文档](docs/development.md)、[桌面端方案](docs/desktop-packaging.md) 和 [架构评估](docs/architecture-review.md)。
