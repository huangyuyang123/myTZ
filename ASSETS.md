# 视觉素材说明

2026-10-25 参考用户提供的页面图调整布局、暖色柔光和仪表样式；参考文件仅保存在项目 work/design-reference.jfif，没有把页面截图当作运行界面。新增服务器插画、比例环、资源弧线及网速方向图形由 SummaryArt.vue、MetricBar.vue 和 CSS/SVG 绘制，不依赖图片服务或新增接口。

当前主题使用 assets/makima-background.png，由 src/views/Dashboard.vue 引用，构建时输出为 dist/assets/makima-background-CAI0-wAu.png。它是使用内置 image_gen 生成并调整构图的《电锯人》玛琪玛原创同人插画，未从动漫官网或其他站点下载，也未使用 CLI/API 密钥流程。

最终构图中人物位于左侧：铜红色头发与辫子、圈纹金色眼睛、白衬衫和黑色领带；右侧保留较安静的日落城市背景，供页面中的 CHAINSAW MAN 标题使用。文字、标志、锯齿边框和卡片装饰由 HTML/SVG/CSS 绘制。

原始图片为 1,969,975 字节。主题使用本地文件，不依赖外链图床；后台自定义背景仍可覆盖默认背景。图片只属于静态页面资源，不增加监控 API 请求或轮询。站点名称继续读取后台配置，动漫标题属于主题装饰，不代表官方授权。

旧版电次的 chainsaw-hero.png / chainsaw-hero.webp 于本次清理移除，当前源码、样式与测试不再引用它们。原先单独的玛琪玛预览制作说明合并到本文件，以下保留原始生成和最终调整提示词。

## 初次生成提示词

Use case: illustration-story. Asset type: wide website background and hero banner, landscape 1536x1024. Primary request: an anime illustration of Makima from Chainsaw Man, unmistakable red/copper hair with straight bangs and a long braid, golden amber eyes with concentric red rings, pale skin, calm subtle smile, white collared button shirt and black necktie. Single adult woman, waist-up portrait on the RIGHT third of the canvas, head fully visible with ample margin above, looking at viewer. Left 55 percent is subdued empty atmospheric background for HTML title overlay. Muted graphite urban silhouettes, desaturated burgundy and warm ivory light, fine manga ink texture, detailed clean cel shading, dramatic restrained cinematic composition. Character is the only focal subject. No text, no lettering, no logos, no watermark, no additional people, no weapons, no gore. Artwork should function as a legible web dashboard background with clear face on the right.

## 最终构图调整提示词

Edit this generated Makima illustration for a website hero background. Move Makima to the LEFT third of the canvas, with her head fully inside the image and a little breathing room above it. Keep the same character identity, copper red hair and braid, ringed amber eyes, white shirt and black tie, calm expression, clean anime rendering, muted cinematic sunset city palette. The RIGHT 55 percent must be quieter city/sky negative space for a large HTML title. Preserve landscape aspect ratio. No text, no lettering, no logos, no additional people. This replaces the previous right-side composition.
