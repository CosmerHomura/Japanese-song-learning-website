# 开发与构建

当前主要验证平台是 Windows 10/11 x64。需要 Node.js 20+、Python 3.10+。Python 依赖必须安装到项目独立虚拟环境 `server/.venv`，不要使用主环境。

在项目根目录打开 PowerShell：

```powershell
npm.cmd ci
py -3 -m venv server/.venv
server/.venv/Scripts/python.exe -m pip install -r server/requirements-build.txt
npm.cmd run dev
```

网页开发地址为 `http://localhost:5173`；本机标注 API 为 `http://127.0.0.1:8000`。桌面开发可运行 `npm.cmd run desktop:dev`。打包前退出正在运行的旧版应用，避免 Windows 占用文件：

```powershell
npm.cmd run desktop:package  # out/win-unpacked/UTA.exe，便携验收版
npm.cmd run desktop:make     # out/UTA-Setup-<版本>.exe，NSIS 安装包
```

验收阶段可反复使用当前版本号构建安装包，应用的 **设置 → 关于与更新** 会显示构建时间，便于辨认是否打开了新包；同版本包不会通过自动更新互相替换。正式定版发布时，再在 `package.json` 与 `package-lock.json` 提升版本号并构建安装包；将代码直接推送到 `main`。在 GitHub 为相同版本创建正式 Release（例如 `v0.1.2`，不要设为草稿或预发布），上传 `out/UTA-Setup-<版本>.exe`、`out/UTA-Setup-<版本>.exe.blockmap` 和 `out/latest.yml`。三者须来自同一次构建；不要只上传 EXE 或将旧版 `latest.yml` 搭配新版安装包。更新功能由 `electron-updater` 读取公开 Release；只有安装了带更新功能的 `0.1.1` 或更新版本，才能自动发现后续更高版本。此前的 `0.1.0` 没有更新客户端，需要手动安装 `0.1.1` 或更新版本。桌面快捷方式由 NSIS 安装器自动创建。

应用启动约 10 秒后自动检查一次，之后每 6 小时检查，也可以在 **设置 → 关于与更新** 手动检查。发现新版本不会自动下载；用户点击下载并确认重启后才安装。开发版与便携验收目录不用于验证自动升级，应使用正式 NSIS 安装版和一个更高版本的测试 Release 验证。发布前建议在干净 Windows 用户环境测试安装、快捷方式、更新和原有学习数据。

测试：

```powershell
npm.cmd run build
node --test tests/*.test.mjs
server/.venv/Scripts/python.exe -m unittest discover -s server/tests
```

桌面端由 Electron 启动本机 FastAPI sidecar，网页产物由 FastAPI 同源提供；PyInstaller 将 Python 运行时、Sudachi 核心词典和静态页面一起冻结。用户歌曲、词典数据库、API Key、本机模型目录缓存和构建产物都不可提交。密钥由 Windows DPAPI 加密保存在当前用户配置目录；即使这样也不应放进截图、日志或共享解析。

桌面模式下付费 AI 请求经 Electron 受限 IPC 附加当前会话令牌；直接向本地端口请求付费路由会被拒绝。网页开发模式没有桌面会话令牌，仍可使用本机 `.env` 配置。学习记录集中保存在带版本号的本地快照，旧 Local Storage 键与旧版 `.uta-backup` 会自动兼容迁移；歌曲和音频仍由 IndexedDB 保存。

如果在开发环境维护内置歌曲，将 `.lrc` 放入 `geci/`，对应音频放入 `song/`，再运行 `npm.cmd run lyrics:sync`。生成的 `src/data/songs.generated.js`、真实歌曲、音频与封面不进入公开仓库。

网页开发版仍兼容 `server/.env.example` 中的 DeepSeek 配置，但 `.env` 必须留在本机。可选 Tomoshi 词典的许可证和署名要求见 [第三方数据声明](../THIRD_PARTY_DATA_NOTICES.md)。

目录概览：`src/` 是 React 前端，`server/` 是 FastAPI 与本地语言处理，`desktop/` 是 Electron 与打包配置，`tests/` 和 `server/tests/` 分别是前后端测试。更详细的桌面方案见 [desktop-packaging.md](desktop-packaging.md)。
