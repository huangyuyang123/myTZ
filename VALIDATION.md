# 验证记录 · 2026-10-11

状态：源码、本地构建和模拟验证通过；真实 Worker 的**公开 + Turnstile 开/关**两种组合已通过当前浏览器访问、历史和实时更新测试。两种私有组合的未登录跳转已检查；**私有登录后数据访问及真实 401/403 恢复仍待验收，尚未提交主题商店或发布到 GitHub。**

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
- [ ] 私有、Turnstile 关，内置后台登录后 Cookie WS 与跨域 JWT WS。
- [ ] 私有、Turnstile 开，JWT 与 Turnstile 在 servers/server/history/all 同时生效，WS 鉴权成功；真实 401/403 不产生循环。
- [ ] 所有测试 Worker 配好 CORS_ALLOWED_ORIGINS，线上静态地址 CSP 与后台外观资源加载正常。
- [ ] GitHub 实际运行两次构建，确认 dist 提交历史追加、说明等于触发源码说明，并从 Settings → Pages 选择 dist/root 正常托管。

用户已提供测试 Worker 地址。2026-10-11 首次使用 workers.dev 地址时，浏览器打开未完成，GET `/api/config` 的接口直连连接超时，没有获得 HTTP 状态或配置内容。随后用户提供自定义域名，接口直连已成功：

- GET `/api/config`：HTTP 200；版本 `2.8.5 Beta5`；`is_public === true`；`turnstile_enabled === true`；匿名 `authorization === false`；`frontend_ws_timeout_minutes === 0`。
- GET `/api/servers`，不带验证凭证：HTTP 403，`Turnstile verification failed`。这验证了当前后端要求验证凭证，但不等同于主题已通过真实 Turnstile 挑战与完整数据访问测试。
- OPTIONS `/api/servers`，Origin 为 `http://127.0.0.1:5173`：HTTP 204，没有 `Access-Control-Allow-Origin` 或 `Access-Control-Allow-Credentials`。当前配置未允许该本地主题预览 origin 跨域读取。

测试地址仅作为运行时输入使用，未写入仓库文件。最初的连接和 CORS 阻碍已按下面记录解决；私有完整验收和目标仓库 Actions 运行仍未完成。后台开关经用户明确授权短时调整，并已恢复原值，详见下方记录。

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

主题所在本地 origin 没有 JWT，后端 origin 的登录状态不会自动迁移至本地 origin。当前没有目标 GitHub 仓库或同源主题预览部署，所以私有登录后的 REST、Cookie WS、跨域 JWT WS 以及真实 401/403 恢复没有完成。**不能把未登录跳转成功计作私有组合完整通过。**

### 原设置恢复（已确认）

测试结束后，内置后台的公开访问和全局 Turnstile 复选框均恢复开启，并显示“设置保存成功”。2026-10-11 19:15:47（Asia/Shanghai）重新打开本地主题：真实 config 再次返回 public=true、turnstile=true、authorized=false；servers HTTP 200，使用原缓存验证凭证而无 JWT，首页恢复显示 7 台服务器。未修改登录 Turnstile 开关或其他后台设置。

模拟用的占位站点名、服务器和图标只在 tests/browser 中；生产主题无内置示例监控数据。附带预览图同样来自模拟数据，不代表真实部署。

纯静态站不能用配置 API 获得当前后端未公开返回的 custom_bg/custom_head/custom_script。要使用这些后台外观设置，应由 Worker 代理/服务主题 HTML；直托管背景通过 Secret 注入。未通过额外端点绕过该限制。
