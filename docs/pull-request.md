# PR 描述与上游投稿

## 标题

feat: add Windows desktop app and improve Japanese song learning workflow

## 描述

### 变更概要

- 使用 Electron + PyInstaller + electron-builder 构建 Windows x64 桌面应用，Python 开发依赖独立安装在 `server/.venv`。
- 默认从歌曲库开始；优化逐句学习、复习、进度可视化、字号与动效，以及统一应用图标。
- 将设置拆为 AI、本地词典、阅读与动效分类；启动后后台刷新模型，刷新不阻止关闭设置。
- 接入主流 AI 供应商及模型目录，按歌曲记录人民币估算费用；本机 Key 使用 Windows DPAPI 加密并支持选择、删除。
- 支持 Tomoshi 词典下载、取消、续传与本地上传，显示下载进度。
- 支持手动合并 / 拆分词并实时重新查词，AI 根据整句检查分词，经确认后应用，支持撤销且不改写歌词。
- 支持无 API Key / 音频 / 歌词正文的共享解析文件；保留个人备份流程。
- README 标注 fork 原项目来源并更新安装、构建与功能说明。

### 验证

- `npm.cmd run build` 成功。
- `node --test tests/*.test.mjs`：23 项测试通过。
- `server/.venv/Scripts/python.exe -m unittest discover -s server/tests`：20 项测试通过。
- Windows 便携版打包成功；打包的前端资源与当前构建哈希一致。
- 不提交 API Key、本机模型缓存、用户数据、真实歌词 / 音频、数据库或构建产物。

### 已知限制

- 当前桌面构建面向 Windows x64，正式发行签名、自动更新和其他平台适配未完成。
- 厂家实时调用权限、价格和 AI 建议需要用户自行核验；估算费用不代替供应商账单。
- 不包含自动下载受版权保护的歌曲功能。

## 如果以后向原仓库投稿

本次 PR 的 base 应为自己的 `CosmerHomura/Japanese-song-learning-website:main`，不要自动切换至上游。

如果希望另外提交给原作者：在 GitHub 点击 **Pull requests → New pull request → compare across forks**，选择：

- base repository：`meilawiet/Japanese-song-learning-website`
- base：`main`（提交时再确认原仓库默认分支）
- head repository：`CosmerHomura/Japanese-song-learning-website`
- compare：本次功能分支，或本次 PR 合并后的 `main`

检查差异后填写上面的标题和描述再创建 PR。给原作者的 PR 可能包含此前 fork 的全部变更，应先确认其接受桌面版方向；必要时拆成桌面封装、模型与词典、学习界面三个更小的 PR。
