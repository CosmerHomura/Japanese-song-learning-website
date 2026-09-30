# Windows 桌面封装方案

## 结论

首个桌面版本采用 **Electron + PyInstaller + electron-builder**，目标平台为 Windows x64。

- Electron 复用现有 React 页面，负责窗口、单实例和进程生命周期。
- PyInstaller 把 FastAPI、SudachiPy、Sudachi 核心词典和 Vite 产物打成独立 sidecar；最终用户不需要 Python 环境。
- electron-builder 生成 NSIS 安装包，已接入统一图标、桌面快捷方式和 GitHub Release 更新元数据；代码签名和发布流水线仍待配置。
- 生产版由 FastAPI 在 `127.0.0.1:14731` 同源提供页面和 API，避免给本地 API 放开宽泛 CORS，也让 IndexedDB 使用稳定 origin。

## 为什么首版不选 Tauri

Tauri 的壳体积更小，但当前项目仍需要分发体积较大的 Python/Sudachi sidecar，因此整体安装包并不会按壳体积同比缩小。同时它会新增 Rust 工具链、sidecar 权限配置和更多跨语言排障点。等本地标注服务能迁移到 Rust 或远程服务后，再评估 Tauri 更合理。

## 数据与安全边界

- Electron 渲染进程启用 `contextIsolation` 和 sandbox，禁用 Node.js 集成。
- 非应用内链接交给系统浏览器打开。
- API 仅监听回环接口，应用退出时回收 sidecar。
- 用户歌曲、学习记录和 Electron 存储留在用户数据目录；不会进入安装包。
- AI Key 与供应商设置只保存在 `%APPDATA%\UTA\ai-settings.json`；渲染进程只能通过受限 IPC 读写脱敏设置，Key 不进入浏览器存储、备份或共享解析。
- 可选 Tomoshi 数据库只从 `%APPDATA%\UTA\data\` 读取，既不提交 Git，也不默认随安装包分发。
- 首次启动在用户明确同意后才下载 Tomoshi 数据；设置页和应用内浮窗显示进度并允许取消，自动下载支持保留部分文件并重试续传，网络不佳时可从发布页手工下载。设置页也接受 `.db.zst`、`.db`、`.sqlite`、`.sqlite3`，并在安装前校验必需数据表。
- `.uta-analysis` 只用歌词哈希匹配本地歌曲，不包含歌词正文、音频或 Key；完整 `.uta-backup` 仍只用于个人迁移。

## 发布与待办

正式 Windows 安装版启动后检查公开 GitHub Release；用户可在设置中手动检查、下载并重启安装。发布时必须将同次构建的 NSIS EXE、blockmap 和 `latest.yml` 一起上传，详见 [开发与构建说明](development.md)。源码改动验证后直接推送 `main`，无需为每一步开 PR。

正式大规模分发前仍需完成 Windows 代码签名、干净系统上的更新验收，以及可重复的 GitHub Actions 构建和 Release 上传；macOS/Linux 适配另行处理。

## 验收清单

- `npm run desktop:dev` 能打开桌面窗口，注音 API 正常。
- `npm run desktop:make` 生成 `out/UTA-Setup-<版本>.exe`。
- 安装版创建桌面快捷方式；发布更高版本及配套 `latest.yml` 后，旧安装版能发现更新、下载并在确认重启后安装。
- 在未安装 Node.js/Python 的干净 Windows 用户环境中可安装、启动和退出。
- 导入歌曲、重启应用后 IndexedDB 数据仍存在。
- 关闭窗口后 `uta-backend.exe` 不残留。
- 首次词典提示可选择自动下载、导入兼容本地数据库或跳过；设置页可再次操作，浮窗能显示进度、取消、续传、重试或打开发布页。
- AI 设置覆盖主流供应商，可通过厂家接口实时读取模型下拉列表、自动补齐人民币价格，并记录 token 与每首歌估算费用；Anthropic、Gemini 和 OpenAI 兼容协议分别验收，共享解析导入后无需重复生成。
- 内置无音频示例不显示可用的播放按钮；导入 MP3/M4A/WAV/OGG/WebM 后逐句播放有声，错误编码与 LRC 时间越界有明确提示。
- API Key、真实歌词、音频、用户备份与可选大词典均未进入 Git 或安装包。
