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

测试：

```powershell
npm.cmd run build
node --test tests/*.test.mjs
server/.venv/Scripts/python.exe -m unittest discover -s server/tests
```

桌面端由 Electron 启动本机 FastAPI sidecar，网页产物由 FastAPI 同源提供；PyInstaller 将 Python 运行时、Sudachi 核心词典和静态页面一起冻结。用户歌曲、词典数据库、API Key、本机模型目录缓存和构建产物都不可提交。密钥由 Windows DPAPI 加密保存在当前用户配置目录；即使这样也不应放进截图、日志或共享解析。

如果在开发环境维护内置歌曲，将 `.lrc` 放入 `geci/`，对应音频放入 `song/`，再运行 `npm.cmd run lyrics:sync`。生成的 `src/data/songs.generated.js`、真实歌曲、音频与封面不进入公开仓库。

网页开发版仍兼容 `server/.env.example` 中的 DeepSeek 配置，但 `.env` 必须留在本机。可选 Tomoshi 词典的许可证和署名要求见 [第三方数据声明](../THIRD_PARTY_DATA_NOTICES.md)。

目录概览：`src/` 是 React 前端，`server/` 是 FastAPI 与本地语言处理，`desktop/` 是 Electron 与打包配置，`tests/` 和 `server/tests/` 分别是前后端测试。更详细的桌面方案见 [desktop-packaging.md](desktop-packaging.md)。
