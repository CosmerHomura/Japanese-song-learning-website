# 架构整理（2026-10）

技术栈保持 React/Vite、Electron、FastAPI、SudachiPy/SQLite 和 IndexedDB。本轮完成此前列出的页面、业务服务和学习存储拆分，保持现有 API、备份格式和版本号不变。

## 前端职责

- `App.jsx`：组合业务控制器、导航和当前歌曲上下文，不再承接导入、词语校正和学习页布局的全部实现。
- `src/pages/`：歌曲库、歌曲学习、复习；导入、备份、词语侧栏、词典浮窗、操作引导分别是独立组件。
- `useLocalLibrary`、`useSongImport`、`useLearningBackup`：曲库加载、导入预览、备份与恢复。
- `useLearningStore`、`usePractice`：学习状态与跟练/复习会话。
- `useSongAnnotation`、`useWordLearning`、`useSentenceExplanations`：本地注音/词典刷新、选择和词语校正、AI 句子解析。切换句子后过期的 AI 解释不再打开当前侧栏，已发生的费用仍记入原歌曲。
- `useAiSettings`、`useDesktopServices`：模型与 Key、启动后台刷新、词典安装和更新状态。词典下载时较频繁轮询，空闲时降低频率。
- `useLineAudio`、`useReadingPreferences`、`usePageNavigation`：音频生命周期、显示与动效偏好、横向导航方向。初次打开及重复点击同页不播放切页动效；关闭动效也关闭平滑滚动。
- `MainNavigation`：共用一个可滑动高亮线，按真实标签尺寸定位；字号和窗口宽度改变时重新测量，导航动效与页面统一为 300ms，并遵守减少动态效果设置。
- `AnimatedDetails`、`MotionPresence`、`MasteryButton`：折叠展开/收起、侧栏退场、仅新标记掌握时的确认反馈。`animateUi` 统一处理取消与减少动态效果；收起中的内容禁用交互，侧栏动画完成才卸载。
- `typography.css`：最后加载的可读性规则。默认界面 18px、歌词 28px；支持文字与注音至少 16px，控件不会把歌词词语按钮降为普通界面字号。
- `segmentation.mjs`：以歌词字符跨度匹配修正。重新分词只保留边界和原文未变的人工读音，重复词不会因下标变化串位；撤销恢复原分词和修正。

## 后端职责

- `server/app.py`：创建应用、注册 CORS、路由和静态文件。
- `server/routes/`：标注、AI、设置、词典、封面、句子上下文的请求与授权边界。
- `server/schemas.py`、`config.py`：请求模型与运行路径/会话配置。
- `server/services/annotation.py`、`japanese.py`、`lexicon.py`、`dictionary.py`：分词、日语读音、语法资料与词典查询。安装/替换词典和查询共享锁；缓存按数据库修订标识失效，安装后无需重启。
- `ai_settings.py`：本机加密 Key 与配置；完整读改写受锁保护，避免并发保存覆盖其他账号。
- `model_catalog.py`：模型目录、价格和缓存；`ai_runtime.py`：请求、结果缓存、限流、JSON 校验及计费；`ai_cache.py`：共享锁和缓存状态。
- `lyric_context.py`、`artwork.py`：句子上下文验证和封面匹配。现有供应商适配、计费归一化与桌面授权模块保留。

AI 读音复核优先使用用户当前的分词和读音，而非重新覆盖为原始自动分词；服务在调用供应商前校验词面能还原原句。

## 数据与安全边界

`localDatabase.js` 管理数据库生命周期和串行写入；`applicationRepository.js` 协调曲库与学习记录。数据库 v2 中同时保存歌曲和 v2 学习快照，旧数据库曲库保留，旧 Local Storage 快照在新记录持久化后才移除。

删除歌曲与清理修正、费用等关联记录同事务提交；备份恢复中的清空、歌曲写入和学习快照写入也在同事务中，任何失败整体回滚。恢复提交后阻止旧自动保存覆盖新数据；删除后延迟返回的 AI 结果不能重建该歌曲记录。遇到未来版本快照停止写入，不将其降级覆盖。

桌面管理与付费 API 经受限 IPC 附加会话令牌，服务只监听回环地址。CORS 不代替授权。Windows Key 使用 DPAPI 加密；歌曲、密钥、生成数据与本机缓存不可进入版本库。

## 验证与发行边界

单元测试覆盖迁移、关联清理、字符跨度校正、读音、备份、时间轴、授权、词典替换和 AI 复核当前分词等。隔离 Electron 回归覆盖实际导入与合成音频播放、分词合并/撤销、学习复习、过期 AI 结果、左右切页、数据事务失败回滚及后台刷新时关闭设置；不读取真实曲库，不调用付费 AI。

这些检查不代替干净 Windows 环境中的真实安装、快捷方式及跨版本自动升级验收，也不代替真实供应商兼容性或独立安全审计。验收期间保持版本号，以构建时间辨认安装包；定版后再创建更高版本的正式 Release。
