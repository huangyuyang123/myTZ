# 验证记录 · 2026-10-12

## 发布故障与后续修复（优先阅读）

固定构建 `96ac13439bc3e83bdf2d4d2e21b7b66d350452f0` 已被应用，但线上停在 Loading，不能计作验收通过。该提交首页引用 `index-Dsiw3XQl.js`，实际只有 `index-r1cIS3aA.js`；Git 历史显示更换脚本和插画时首页没有同步更新。此前只校验产物结构及相对地址，漏检引用是否对应真实文件。

本地修复：发布同步改用 `rsync --checksum`，按内容判断是否更新；同步后的部署目录再次运行资源校验，缺失脚本或样式时停止提交和推送。新增三个回归覆盖完整资源、旧哈希引用、缺失样式及越界地址。已知同长度首页被快速同步跳过是最可能原因，具体执行时的时间戳未取得，不能把它写成已观察到的事实。

发布故障修复已在本地通过 19 项核心检查、生产构建及资源校验；用真实故障版本重建的目录被新增校验拒绝，当前本地产物通过。此前 15 项隔离浏览器回归对应未再修改的监控页面源码。本章节记录上线前验证；远程发布后还需确认入口引用正确、普通首页和真实监控功能正常，不能以旧构建的 success 替代。

2026-10-12 网站恢复：首个按内容同步的固定构建 `1a69464a99a3767e3cd5223d8c9785689d5a8141` 构建成功，入口引用和三个资源文件已核对。用户在已登录的普通 Chrome 后台应用此版本，并确认首页显示 7 台服务器。独立自动操作窗口的 Turnstile 返回 600010，未绕过验证、读取登录凭证或接管普通 Chrome 会话。这里的 7 台服务器是用户现场确认，不能代替本轮实时更新、详情及跨域鉴权的独立观察。最终源码、发布校验构建及逐字节比对结果记录在外部交付报告。

## 最新修复回归

本轮修复历史范围被新样本挤掉、320px 横向溢出、多 Worker 选项草稿混写三个可复现问题，并优化首页插画。此处记录发布前的本地验证；线上版本、构建记录和切换后的实测另见交付报告。

- `npm run check`：16 项核心/静态测试通过，生产构建和静态产物结构检查通过。
- 隔离 Chrome 回归：原有 12 项加 3 项新回归均通过。长历史测试先触及默认 30 秒执行时限，改为 90 秒后单独重跑通过，实际运行 38 秒；没有修改生产逻辑来迎合测试。
- 24 小时历史加载后模拟 21 分钟、每秒一次实时更新，仍覆盖 1437 分钟，保留 311 个原始样本。历史 REST 共两次（初始默认范围及主动选择 24 小时），没有自动补拉或轮询。
- 时间分桶单元测试覆盖 CPU、网速、磁盘 IO、GPU 峰值，以及 null 超时、false 空值、正常 0；保留范围两端，最多 1200 点，时间去重和过期删除不修改输入记录。
- 多站测试中，B 的保存对象不含 A 的未知键；B 自己的未知键保留，关闭后重新打开仍读取 B 的强调色。
- 长中文名称的 320/360/390px 页面，scrollWidth 分别为 320/360/390，无横向溢出。
- 插画改用 720 × 863 透明 WebP，515,820 字节，较原 PNG 减少 74.1%；缩放后的 RGBA 与 WebP 解码结果一致。

本轮未修改认证、请求封装、WebSocket 连接协议或后台访问保护。跨域 JWT WS 和真实 401/403 恢复仍待独立验收。

## 前一轮验证记录（2026-10-11）

状态：源码、本地构建和模拟验证通过；真实 Worker 的**公开 + Turnstile 开/关**两种组合已通过访问、历史和实时更新测试。**私有 + Turnstile 开/关**两种组合的未登录跳转及登录后同源首页、详情、历史和实时更新已检查。源码已发布到用户指定的 GitHub 仓库，推送与手动构建均成功。**跨域 JWT WS 及真实 401/403 恢复仍待验收，尚未满足完整验收条件，不提交主题商店。**

参考核对的官方源码 commit：`79679db2dbef281865c3d670839c79aaa1c0adc1`。

## 已执行

- `npm run check`：14 项核心/静态审计测试通过，Vite 生产构建通过，构建根目录及相对资源地址检查通过。
- Chrome 浏览器回归：12 项测试通过（最新一次通过独立 5174 端口运行，避免复用带真实后端配置的 5173 预览）。请求、WebSocket、Turnstile 和静态图标均由测试夹具模拟，没有连接真实 Worker、调用后台接口或消耗 D1。
- 桌面 1440px 与手机 390px 截图已人工检查；手机 document.scrollWidth 不超过视口宽度。

| 浏览器测试 | 结果 |
| --- | --- |
| 公开 + Turnstile 关：首页、单台 WS、详情和刷新 | 通过（模拟） |
| 公开 + Turnstile 开：验证交换、缓存、刷新复用 | 通过（模拟） |
| Turnstile 主机未授权：明确提示、无自动重试，点击重试才再验证；不查询监控数据 | 通过（模拟） |
| 私有 + Turnstile 关：JWT 请求、首页与详情 | 通过（模拟） |
| 私有 + Turnstile 开：JWT 与验证凭证共同使用 | 通过（模拟） |
| 匿名私有站跳内置后台，不请求列表 | 通过 |
| 路由返回首页不重查 config/servers | 通过 |
| 隐藏停止更新；恢复只补当前列表/指标，不补历史 | 通过 |
| 高频 WS 批次只取最新值，更新间隔至少一秒，报告级字段保留 | 通过 |
| 多站连接仅发送本后端 IDs；跨域 JWT；详情只用对应 Worker | 通过 |
| theme_options 保存端点、JWT、保留其他键 | 通过 |
| 五分钟无报告卡片转离线，不发 REST，后端 stats 快照不重算 | 通过 |
| 桌面/手机布局、无横向溢出 | 通过 |

核心测试另覆盖：增量字段合并，probe false/null/0，JSON GPU，免费/未设置价格，history hours 白名单，非法配置对象拒绝，401 单次跳转且清 JWT，403 只重验补试一次，多个并发请求共用一次验证，WS 同源不带 URL token / 跨域带 token，1/2/4/8/16/30 秒退避及最多六次，短暂打开后立即关闭也不无限重连，绝对会话截止时间且不会静默续期。

## 消耗与实现自查

- [x] 生产源码只使用 config、servers、server、history/all、ws、theme_options 六个监控端点。
- [x] config 首次初始化缓存；Turnstile 交换例外已得到用户明确批准，详见 README。
- [x] 每个 Worker 的首页列表首次进入一次；可见性恢复例外一次；无 setInterval / REST 轮询。
- [x] 独立详情用 subscribe=ID；首页用 subscribe=all 并发送本后端 IDs。
- [x] 首页探测小图只使用列表窗口；后台开关未开、数组为空时不画，也不补拉历史。
- [x] 详情资源、ping/loss、disk、GPU 均使用同一个 history/all 响应；自动恢复只拉当前指标。
- [x] WS 隐藏关闭、指数退避限次、配置时限主动暂停；路由切换不重置会话截止时间。
- [x] 按字段时间戳保留新样本和缺失字段；每秒最多更新一次响应式样本；每个后端每轮只遍历列表一次。
- [x] 数字固定宽度且使用 tabular-nums；在线/离线芯片同宽同高。
- [x] false/缺失隐藏，null 显示超时且在图上标记，0 有效。
- [x] 磁盘 IO 缺失时无相关图；只读 disk；GPU 只读 gpu_info 并解析历史字符串。
- [x] 字节、B/s、MB 语义正确；免费价格和字符串标志未按布尔值误判。
- [x] 管理入口只到内置 /admin#/admin，无管理页或登录页，无 reload 验证循环。
- [x] 产物根目录只有 index.html + assets/；系统图标和旗帜使用源 Worker 默认静态路径。
- [x] title / preferred_theme / default_language / theme_options 由配置控制；后台 HTML 注入的背景/head/脚本保留。
- [x] 页面脚部包含指定项目链接和后端版本。
- [x] workflow main/master/手动触发、Secrets 注入、dist 追加历史、源码完整提交说明、concurrency、无 force push；已做静态审计。

## 必须在真实环境补验

- [x] 公开、Turnstile 关，无凭证首页与真实 WS 持续推送。
- [x] 公开、Turnstile 开，用户完成真实挑战后能读取数据，缓存凭证在刷新后复用；交换请求的现场网络记录未捕获，不能据此宣称已独立审计真实签发过程。
- [x] 两种私有组合：内置后台登录后的同源首页、详情、共享历史及实时更新可用。生产预览未记录脱敏网络诊断，因此这项表示实际使用流程通过，不表示独立审计每条请求头或 WS Cookie。
- [ ] 私有、Turnstile 关，跨域 JWT WS 建连和持续推送。
- [ ] 私有、Turnstile 开，跨域 JWT + Turnstile 同时生效；真实 401/403 恢复不产生循环。
- [x] 测试 Worker 两个域名均已允许用户指定的跨域 origin，OPTIONS 返回正确 CORS 响应。
- [ ] 线上纯静态地址 CSP、Turnstile 与外观资源加载。Worker 同源预览已显示后台标题、版本和默认静态图标。
- [x] GitHub 实际运行推送和手动两次构建；dist 历史追加，提交说明等于触发源码完整说明。
- [x] Settings → Pages 已保存 dist 分支、根目录作为源。
- [ ] Pages 实际 HTTPS 访问：继承的账号自定义域名尚未配置好 HTTPS，按用户选择保留域名。

用户已提供测试 Worker 地址。2026-10-11 首次使用 workers.dev 地址时，浏览器打开未完成，GET `/api/config` 的接口直连连接超时，没有获得 HTTP 状态或配置内容。随后用户提供自定义域名，接口直连已成功：

- GET `/api/config`：HTTP 200；版本 `2.8.5 Beta5`；`is_public === true`；`turnstile_enabled === true`；匿名 `authorization === false`；`frontend_ws_timeout_minutes === 0`。
- GET `/api/servers`，不带验证凭证：HTTP 403，`Turnstile verification failed`。这验证了当前后端要求验证凭证，但不等同于主题已通过真实 Turnstile 挑战与完整数据访问测试。
- OPTIONS `/api/servers`，Origin 为 `http://127.0.0.1:5173`：HTTP 204，没有 `Access-Control-Allow-Origin` 或 `Access-Control-Allow-Credentials`。当前配置未允许该本地主题预览 origin 跨域读取。

测试地址仅作为运行时输入使用，未写入源码仓库文件。最初的连接和 CORS 阻碍已按下面记录解决；当时私有完整验收和目标仓库 Actions 运行尚未完成，后续进展见末尾记录。后台开关经用户明确授权短时调整，并已恢复原值。

用户随后确认已在内置浏览器进入管理菜单。浏览器工具能列出后台标签页，但读取该远程页面持续超时，因此尚未独立确认登录会话或操作后台开关。已通过进程环境变量启动真实后端的本地主题预览（`http://127.0.0.1:5173`）；预览 HTML 和入口模块均 HTTP 200，后端 meta 注入已检查。

用户配置 CORS 后，重新执行一次 OPTIONS `/api/servers`：HTTP 204，`Access-Control-Allow-Origin: http://127.0.0.1:5173`、`Access-Control-Allow-Credentials: true`，请求头白名单正确返回。本地主题已能通过浏览器工具读取，显示真实站点标题和版本；真实 `/api/config` 初始化成功并进入 Turnstile 验证。

真实 Turnstile 最初返回 `110200`（Domain not authorized）。观察到 SDK 默认自动重试后，已修正为 `retry: never`，过期和交互超时均由用户主动重试；110200 显示明确提示。修正后的真实页面已检查，回归测试验证停留在失败状态不查询监控数据，点击重试才再发起挑战。最新 14 项核心/审计测试、12 项浏览器模拟测试和生产构建均通过。

### 真实公开 + Turnstile 开（已通过当前访问流程）

用户添加测试验证主机并自行完成挑战后，本地预览显示真实的 7 台服务器和后台版本。2026-10-11 18:38:32（Asia/Shanghai）明确刷新后，以仅开发模式的脱敏日志核对以下结果；日志只包含路径、状态和凭证是否存在，不包含凭证值：

| 动作 | 实际请求与结果 |
| --- | --- |
| 刷新首页 | `/api/config` 一次 200；`/api/servers` 一次 200，无 JWT，使用缓存的 `X-Turnstile-Verified`，未再次出现验证组件 |
| 首次进入单台详情 | `/api/server` 一次 200；共享的 `/api/history/all?…&hours=0.167` 一次 200 |
| 返回后再进入相同详情 | 复用内存数据，没有再次查询 config、servers、server 或默认历史 |
| 主动选择 30 分钟 | `/api/history/all?…&hours=0.5` 一次 200；下拉框显示 30 分钟，历史图显示约 30 分钟范围 |
| 首页实时连接 | WS 打开，scope=all，idCount=7；指标持续变化，开发日志记录批次合并 |
| 单台实时连接 | WS 打开，scope=single，idCount=1；资源与网络指标持续变化，图表追加实时样本 |
| 再次返回首页 | 仍未重复查询配置和列表；本次刷新后的整个观察段共五次 REST，只有上述五条 |

实际页面显示 0% 丢包为有效值，超时探测显示“超时”与三角标记；磁盘 IO 历史可读。当前观察段浏览器无 error/warn 日志。因测试站公开，WS 不携带 URL JWT；这不构成私有站鉴权验证。挑战发生在加入脱敏日志前，首次 token 交换的实际请求次数未独立记录。

随后通过浏览器的 DOM 读取成功确认已登录内置后台；设置页面显示“公开访问”和“启用 Turnstile（全局）”均开启，“登录启用 Turnstile”关闭。开发日志在生产构建中删除。

### 真实公开 + Turnstile 关（已通过当前访问流程）

用户明确授权短时测试三种剩余组合并恢复原值后，通过内置后台界面关闭全局 Turnstile 并保存。保存成功弹窗须关闭后才能继续操作其他设置。

2026-10-11 19:00:20（Asia/Shanghai）重新载入主题：config 返回公开、Turnstile 关闭、未授权。config、servers、单台 server 和默认 0.167 小时 history/all 均一次 HTTP 200；所有请求的 JWT、一次性 token 和可复用验证头标志均为 false。首页显示 7 台服务器；首页 WS scope=all / idCount=7，详情 WS scope=single / idCount=1，均打开并收到持续的批次更新。

### 两种私有组合（仅未登录流程通过）

通过内置后台分别保存“私有 + Turnstile 关”及“私有 + Turnstile 开”，本地主题均跳转到内置 `/admin#/admin`。开启 Turnstile 时的脱敏日志只记录一次 config HTTP 200，配置为 public=false、turnstile=true、authorized=false；主题没有先查询监控数据或陷入验证循环。该浏览器在后端 origin 已有登录会话，因此跳转后显示内置管理页。

主题所在本地 origin 没有 JWT，后端 origin 的登录状态不会自动迁移至本地 origin。当时尚无目标 GitHub 仓库或同源主题预览部署，所以私有登录后的 REST、Cookie WS、跨域 JWT WS 以及真实 401/403 恢复没有完成。**不能把未登录跳转成功计作私有组合完整通过。**后续同源预览测试见末尾。

### 原设置恢复（已确认）

测试结束后，内置后台的公开访问和全局 Turnstile 复选框均恢复开启，并显示“设置保存成功”。2026-10-11 19:15:47（Asia/Shanghai）重新打开本地主题：真实 config 再次返回 public=true、turnstile=true、authorized=false；servers HTTP 200，使用原缓存验证凭证而无 JWT，首页恢复显示 7 台服务器。未修改登录 Turnstile 开关或其他后台设置。

模拟用的占位站点名、服务器和图标只在 tests/browser 中；生产主题无内置示例监控数据。附带预览图同样来自模拟数据，不代表真实部署。

纯静态站不能用配置 API 获得当前后端未公开返回的 custom_bg/custom_head/custom_script。要使用这些后台外观设置，应由 Worker 代理/服务主题 HTML；直托管背景通过 Secret 注入。未通过额外端点绕过该限制。

### GitHub 发布与实际构建

用户指定仓库 [huangyuyang123/myTZ](https://github.com/huangyuyang123/myTZ)，并明确选择用作公开主题仓库。通过用户已登录的网页逐目录上传，没有新增 OAuth 权限或保存 Git 凭据。33 个源文件的 blob 与本地通过检查的源码一致，发布源码 commit 为 `02821cd8afc3a3695aae9e3f34fedddd225f6b1c`。

- [推送构建 38140989056](https://github.com/huangyuyang123/myTZ/actions/runs/38140989056)：success；首个 dist commit 为 `ade6540fa196a3cdbfef23c9fa07ef8f702e05a2`。
- [手动构建 38141102705](https://github.com/huangyuyang123/myTZ/actions/runs/38141102705)：success；dist commit 为 `0adf61e5dadb42d9114a126c8bdcfdbaa56ae653`，父提交为上述首个构建，保留两次构建历史。
- 两次 dist 提交的完整说明都与触发源码相同：`发布完整主题并自动构建 dist 分支`。dist 根目录只有 `index.html` 与 `assets/`，共三个文件。
- 已在仓库 Secrets 设置 API_BASE，值来自用户指定测试 Worker。上述两次构建发生在设置 Secret 前，因此它们使用同源回退；后续构建读取该 Secret，不把地址写入源码。
- Pages 已保存 `dist` 分支、`/ (root)`。项目继承账号主站自定义域名 `3567.me`，当前 HTTPS 不可启用。用户选择保留域名并继续 Worker 主题预览，未更改账号主站域名、DNS 或证书设置。

### 后续 CORS 检查

用户追加所需允许来源后，对测试 Worker 的两个域名分别执行 OPTIONS `/api/servers`，Origin 分别为 `https://huangyuyang123.github.io` 与用户指定同源预览站点。四个响应均为 HTTP 204，Access-Control-Allow-Origin 精确匹配请求来源，Access-Control-Allow-Credentials 为 true，Authorization 与 X-Turnstile-Verified 请求头获准。CORS 配置正确不等于已经通过跨域 JWT 或 Turnstile 访问。

### 真实同源私有组合（登录后访问流程已检查）

从内置后台的自定义主题入口启动固定版本 `0adf61e5dadb42d9114a126c8bdcfdbaa56ae653` 的生产构建预览。原站使用的 LuminaPlus 主题未切换。用户自行完成新主题的首次 Turnstile 挑战，随后首页显示 7 台真实服务器和“实时连接”。

最初刷新预览时，内置浏览器显示 ERR_BLOCKED_BY_CLIENT。本次失败不计作通过；立即恢复公开与全局 Turnstile 开启并确认保存。官方预览授权 Cookie 的 Max-Age 为 600 秒，旧预览可能过期；从后台重新启动预览后恢复正常。没有绕过浏览器安全警告或直接调用管理 API。

2026-10-11 21:38–21:40（Asia/Shanghai），在新预览授权有效期内，通过后台界面短时测试：

| 组合 | 观察结果 |
| --- | --- |
| 私有 + Turnstile 开 | 保存成功后刷新首页，显示 7 台服务器与“实时连接”，没有再次弹验证；racknerd 详情显示真实 CPU、内存、网络和默认 10 分钟历史，包括延迟、丢包、磁盘 IO；指标持续变化，历史右端追加当前时间样本 |
| 私有 + Turnstile 关 | 保存成功后刷新详情，真实指标与共享历史正常载入；返回首页显示 7 台服务器与“实时连接”，无验证组件；指标持续变化 |

两个观察段没有 error/warn 控制台日志。生产构建不包含开发诊断；没有读取、复制或打印 JWT、Cookie、验证凭证，也没有独立记录该生产预览的请求次数或认证头。这些结果支持同源登录后功能可用，不能代替跨域 WS 和真实失效恢复验收。

结束后再次确认后台“公开访问”为 true、“启用 Turnstile（全局）”为 true、“登录启用 Turnstile”为 false，并显示“设置保存成功”。CSP API 域名白名单原值为空；用户选择保留原值，因此未进行需要扩展连接白名单的跨域 JWT 测试。真实 401/403 恢复仍待验收。

### 电锯人视觉版本

按用户指定动漫风格修改页面视觉：安全橙、墨黑与灰白配色；漫画海报首页，透明角色插画，锯齿品牌图形，粗线框服务器卡片和统一详情样式。强调色默认值改为 #f26b38，已存储的用户强调色仍保留；深浅色仍读取后台 preferred_theme。插画为内置图像工具生成的原创同人 PNG，生成说明见 ASSETS.md，通过 Vite 输出到 assets，不增加监控或管理请求。

本次没有修改 useMonitor.js、utils/http.js、utils/api.js、utils/socket.js、utils/metrics.js、challenge.js 或 TurnstileGate.vue。生产构建和 14 项核心/静态检查通过；12 项隔离浏览器回归通过，覆盖四种模拟组合、既有请求次数、WS 合并与订阅、隐藏恢复和主题选项。桌面、详情、手机与浅色截图已人工查看，均无横向溢出；模拟后台 preferred_theme=light 时切换为浅色纸张配色。此前真实 Worker 的功能观察属于上一固定构建，不能将它写作本次新视觉已重新完成全部真实组合测试。跨域 JWT 和真实失效恢复的未完成状态保持不变。
