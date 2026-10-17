# Chainsaw · CF-Server-Monitor 第三方主题

独立 Vue 3 + Vite 主题，支持 hash 路由、响应式卡片、资源和网络历史、GPU、磁盘 IO、深浅色、中英文和多 Worker。生产页面不附带模拟数据。

当前视觉为《电锯人》动漫主题：安全橙、墨黑与灰白配色，玛琪玛海报首页与细锯齿节点卡片。详情页采用锯齿页头、资源概览、实时网络和带刻度的历史图表，兼容手机与深浅色。深浅色仍由后台 preferred_theme 控制，强调色仍可在 theme_options 调整；页面不增加监控接口、轮询或数据查询。插画为本次生成的原创同人图，来源和提示词见 ASSETS.md。

## 本地使用

需要 Node.js 22 或更新版本。

```sh
npm ci
npm run dev
npm run check
```

默认读取同源后端。静态或本地跨域部署需要 `API_BASE` 环境变量，也可以在 HTML 的 `meta[name="apiBase"]` 中配置一个或多个 Worker **origin**，英文逗号分隔。不要填路径、账号、查询字符串。

```sh
# 在当前终端设置 API_BASE 后运行
npm run build
```

构建产物在 `dist/`，严格只有 `index.html` 和 `assets/`；脚本和样式使用相对地址。源码根目录与构建目录是两种不同交付物，请勿把整个源码目录作为主题产物提交。

首页 `/#/`；详情 `/#/server/:id`。多站详情附带 `?site=<后端索引>`，不改变详情路由格式。后台入口使用所选 Worker 的 `/admin#/admin`，主题不实现登录或管理功能。

## GitHub Pages

1. 把本目录内容放在主题仓库根目录，提交源码和 `package-lock.json`。
2. Settings → Secrets and variables → Actions 添加 Repository Secrets：`API_BASE`、`TITLE`、`BACKGROUND_IMAGE`、`CSP_API`、`CSP_STATIC`。不使用的可留空。Worker 地址只放 Secret，不写进源码。构建后地址必然会作为浏览器运行时配置出现，Secret 注入并不使公开前端的后端地址保密。
3. `CSP_API` 和 `CSP_STATIC` 填允许的完整 origin，逗号或空格分隔。远程背景、字体和自定义外部脚本的来源需放进 `CSP_STATIC`。API 与对应 WS origins 从 `API_BASE` 自动加入 CSP。
4. Settings → Actions → General → Workflow permissions 允许读写；workflow 已声明 `contents: write`。
5. 推送 `main` / `master` 或手动运行 workflow。它会构建并向 `dist` 分支**追加提交**，保留源码 HEAD 的完整提交说明。没有 force push，并使用 concurrency 串行部署。源码说明通过文件传给 Git，不作为 shell 命令执行。
6. Settings → Pages → Deploy from a branch，选择 `dist` / root。

每个 Worker 均需设置 `CORS_ALLOWED_ORIGINS`：只填纯 origin，多个值用逗号分隔，无路径、参数或末尾 `/`。例如填本地开发 origin 及 GitHub Pages origin；多个仓库的 Pages 路径不属于 origin。跨域私有站需要主题所在 origin 的 `localStorage.jwt_token`；Worker origin 的 localStorage 无法跨域自动读取。请按平台支持的登录/凭证交接流程提供 JWT，不在主题内增加登录接口。WS 同源使用 `cfsm_auth` Cookie，跨域附带 `token`。

使用真实 Turnstile 公钥做本地验收时，对应测试组件还需允许预览主机（Hostname Management 填主机名，不含协议和端口）。`110200` 表示主机未授权；主题会显示错误并停止自动重试，由用户配置完成后主动重试。生产组件建议不保留本地主机授权，详见 [Cloudflare 本地测试说明](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)。

## 配置与外观

站点标题、语言、preferred_theme 来自首次缓存的 `/api/config`。背景优先由后台注入的 HTML/CSS 控制；静态托管可通过 Secret `BACKGROUND_IMAGE` 注入 meta。当前官方 `/api/config` 不返回后台的 `custom_bg`、`custom_head`、`custom_script`，它们由 Worker 服务 HTML 时注入，因此纯 GitHub Pages 直连无法仅靠配置 API 同步这些未返回的字段。主题不为此调用管理接口。Worker 托管会保留后台注入内容；未来配置返回背景/脚本字段时也支持读取。后台注入的自定义脚本本身可能发起额外请求，属于管理员的独立代码，不属于主题的内置请求流程。

主题自身 `theme_options` 默认值：

```json
{"density":"comfortable","accent":"#f26b38","showCharts":true}
```

顶部仅保留站点首页链接和管理齿轮，不提供前台主题设置入口。卡片密度、强调色和小图开关继续读取后台 `theme_options`。localStorage 仅用于平台 JWT 和按 Worker 隔离的 Turnstile 凭证，不作为主题选项的唯一存储。

详情页绘图区支持鼠标悬停查看最近的真实样本，提示框显示完整采样日期、时分秒与各条曲线的值；缺失值显示 —，超时显示“超时”，零值正常显示。手机轻点选中、点击图表外关闭，不拦截纵向滚动。图表获得键盘焦点后用左右方向键逐个查看，Home/End 跳到首末样本，Escape 隐藏。实时更新保留所选时间，样本移出窗口或切换时间范围时清除选择。交互仅使用已加载的数据，不发起额外请求。

## 请求预算和已批准的例外

| 事件 | 监控 REST | WS |
| --- | --- | --- |
| 单页初始化，每个 Worker | 配置一次 | 暂无 |
| 首页首次进入，每个 Worker | 列表一次 | subscribe=all + 该后端的 IDs |
| 返回首页 | 使用内存缓存 | 重建首页订阅 |
| 首次进入单台详情 | 当前指标一次 + 默认 0.167 小时历史一次 | subscribe=该 ID |
| 返回已访问详情 | 使用内存缓存，包括已选范围 | subscribe=该 ID |
| 主动切换历史范围 | 所选范围的 history/all 一次 | 保留当前订阅 |
| 页面隐藏 | 无 | 关闭连接和待执行重连 |
| 恢复可见 | 当前页面列表或单台当前指标一次；不重读配置或历史 | 数据载入后重连 |
| 断线 | 不查询 REST | 1/2/4/8/16/30 秒退避，最多 6 次 |
| 会话时限 | 无自动查询 | 主动关闭，用户点击继续才恢复 |

**用户已批准 Turnstile 验证凭证交换例外**：首次配置读取用于获取公钥；没有缓存凭证、或收到明确的 Turnstile 403 拒绝时，人机验证后额外 GET `/api/config` 携带一次性 token 获取 `turnstile_verified`。此响应仅用于签发凭证，不替换已缓存的配置、不刷新监控数据。并发请求共享一个交换流程。数据请求最多补试一次，再失败会显示错误。官方 `/api/ws` 不执行 Turnstile 验证，但私有站仍执行 JWT/Cookie 验证。

以上例外是需求确认后的实现范围，不会以“严格全生命周期只读一次 config”掩盖实际交换请求。

跨域私有请求使用当前 `localStorage.jwt_token`：HTTP 发送 Bearer，WS 仅在不同 origin 时添加 URL token，同源继续使用 HttpOnly Cookie。每次重连重新读取 JWT，避免沿用旧登录。JWT 的 exp 仅作为到期提示，签名仍由后台验证；私有实时连接到期主动关闭并进入内置后台，不增加配置探测或 REST 轮询。依据 [WebSocket 标准](https://websockets.spec.whatwg.org/#feedback-from-the-protocol)，浏览器把握手 401 和其他网络失败统一隐藏为连接失败，因此不把每次 1006 当作已确认的 401；未知失败保持有限退避，并显示停止重试提示。

收到实际 401 时清理本次请求对应的 JWT，并只发起一次后台跳转、关闭现有连接。若响应较晚且 JWT 已被新登录替换，不清除新 JWT，原请求最多用新登录补试一次。仅 HTTP 403 且 JSON 错误为 `Turnstile verification failed` 时清除本次请求对应的旧验证凭证；权限 403、边缘 HTML 拒绝和网络/CORS/CSP 失败均保留验证缓存。并发或迟到响应不会抹掉已经交换的新凭证；重新人工验证和交换最多一次，继续失败就暴露错误。

验证对话框不提供取消入口，Escape 和点击背景不会关闭；验证成功后自动继续。脚本加载失败时保留对话框，显示错误并允许手动重试；重试会重新加载脚本，不复用失败的 Promise。验证交换或数据读取失败后，失败的首页或详情首次加载缓存会释放，允许再次导航进入恢复流程；不自动补拉或轮询。

首页按每台服务器积累增量样本，每秒最多合并一次响应式数据，每个后端每次只遍历列表一次。CPU、内存、Swap、网速及报告级磁盘、GPU、探测字段按字段覆盖，缺失字段保留。首页小图仅使用列表返回的 ping/loss 窗口，没有按服务器补拉历史。总数和在线统计保留后端 stats 的快照口径。

详情所有历史共用 history/all。实时曲线只在内存追加本轮最新样本，不轮询历史。超出 1200 点时按所选时间范围分桶抽样，保留范围两端及代表性的资源峰值、探测超时/空值点，避免 24 小时视图被新样本挤成最近 20 分钟。抽样保留原始记录，不生成平均值或伪造零值。false/缺失不画点，null 显示超时且曲线上留空并标记三角，0 正常显示。磁盘 IO 只读 disk 对象，历史均缺失时不渲染该图。ram/disk 容量为 MB，转换成字节格式显示；网速为 B/s。

手机卡片使用允许缩小的单列网格，320/360/390 像素窗口与长中文名称均已回归检查。角色插画使用透明 WebP，较原始 PNG 减少 74.1% 体积；原始素材仍保留在源码中。

## 验证

```sh
npm run check
npx playwright test
```

浏览器测试默认使用本机 Chrome 路径；Linux/macOS 或其他安装目录请调整 `playwright.config.js` 的 `executablePath`，或安装 Playwright Chromium 并移除该设置。大部分测试使用 mock 后端与 Turnstile；新增原生测试使用只绑定本机的 HTTP/CORS/WebSocket 服务和独立测试 JWT。测试不连接真实 Worker/D1，也不消耗数据库额度。

测试范围及真实后台未完成项见 `VALIDATION.md`。在真实测试 Worker 完成公开/私有 × Turnstile 开/关四种组合验收之前，请勿提交主题商店或宣称已通过真实部署验收。

参考：[官方主题 API 文档](https://github.com/huilang-me/CF-Server-Monitor/blob/main/theme-develop.md)。
