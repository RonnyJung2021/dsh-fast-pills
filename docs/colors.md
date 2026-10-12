# 配色口子

插件画两块面，各有一套自己的口子。

**胶囊行**（输入框上面那排）每一处颜色都先读一个 `--dfp-*` 变量，`--dfp-*` 的默认值再由产品语义色
变量给出。所以换肤会自动跟着变，而想单独改胶囊行的人不必动代码，只覆盖 `--dfp-*` 即可。

**面板**（抽屉与插件卡片）是自己的一整套纸墨，不读产品语义色，见下面第二节。

## 一、胶囊行的变量对照

| `--dfp-*` 变量 | 作用 | 默认值（产品语义色） |
| --- | --- | --- |
| `--dfp-pill-fill` | 普通胶囊的底 | `--dsw-alias-bg-layer-1` |
| `--dfp-pill-stroke` | 普通胶囊的细边 | `--dsw-alias-border-l2` |
| `--dfp-pill-label` | 普通胶囊的字 | `--dsw-alias-label-primary` |
| `--dfp-pill-hover` | 悬停底色（普通胶囊与组胶囊共用） | `--dsw-alias-interactive-bg-hover` |
| `--dfp-pill-quiet-label` | 次要文字（胶囊行上的状态提示） | `--dsw-alias-label-secondary` |
| `--dfp-group-stroke` | 组胶囊的虚线与展开后的实线 | `--dsw-alias-border-l2` |
| `--dfp-group-label` | 组胶囊的字（未展开时） | `--dsw-alias-label-secondary` |
| `--dfp-quick-fill` | 快速胶囊的实心底（琥珀） | `--dsw-alias-state-warn-primary` |
| `--dfp-quick-label` | 快速胶囊的字（深色） | `--dsw-static-neutral-bluish-950` |
| `--dfp-mask-fill` | 抽屉背后那层遮罩 | `--dsw-alias-bg-mask-1` |

## 二、面板的纸墨

面板的纸墨是：米白纸、纯黑墨、直角、一像素实线、等宽数字、
悬浮整块反色。它的颜色不走 `--dfp-pill-*` 那一套，而是自己的一组变量，声明在
`src/client/styles.ts` 里，挂在三个选择器上：`.dfp-drawer-root`（抽屉与它背后的遮罩）、
`[data-dsh-fast-pill-panel="card"]`（插件卡片）、`.dfp-dialog-root`（确认框，portal 到 body，
所以要自己带一份）。

| 变量 | 作用 | 浅色 | 深色 |
| --- | --- | --- | --- |
| `--dfp-paper` | 面板底色（纸） | `#FAF7F5` | `#000000` |
| `--dfp-paper-2` | 凹面：时间线轨道、柱状图底、表头、表单 | `#F3F0EF` | `#111111` |
| `--dfp-ink` | 正文与所有分隔线（墨） | `#000000` | `#FFFFFF` |
| `--dfp-ink-2` | 次要文字 | `rgba(0,0,0,.62)` | `rgba(255,255,255,.64)` |
| `--dfp-ink-3` | 更弱的文字（轴标、字段名） | `rgba(0,0,0,.40)` | `rgba(255,255,255,.42)` |
| `--dfp-ink-num` | 序号栏那个灰 | `#999999` | `#8A8A8A` |
| `--dfp-rule` | 硬分隔线（边框） | `#000000` | `#FFFFFF` |
| `--dfp-rule-soft` | 软分隔线（段间横线） | `rgba(0,0,0,.16)` | `rgba(255,255,255,.20)` |
| `--dfp-invert-bg` / `--dfp-invert-ink` | 悬浮与选中：整块反色的底与字 | 黑底白字 | 白底黑字 |
| `--dfp-brand` | 普通胶囊那一色（时间线色块、柱状图下半截、热力格） | `#0095FF` | `#33ADFF` |
| `--dfp-quick` | 快速胶囊那一色，直接读 `--dfp-quick-fill` | 与胶囊行同一支琥珀 | 同左 |
| `--dfp-ok` / `--dfp-err` | 标签的绿与红、环比下降 | `#1F9D55` / `#D92D20` | `#3FB950` / `#F85149` |
| `--dfp-col` | 序号栏宽度（窄视口下 56px） | `84px` | 同左 |
| `--dfp-mono` | 数字与序号用的等宽字 | 系统等宽栈 | 同左 |

**浅色与深色怎么切：** 两个挂载点的根上写一个 `data-dfp-theme="light|dark"`（`PillDrawer` 写
在 `.dfp-drawer-root` 上，`FastPillsCard` 写在卡片那一节上），第二节那张表里右边的值就是
`[data-dfp-theme="dark"]` 这一组规则给出的。这个属性的值由「设置 → 通用」里的**界面主题**（浅色 /
深色 / 跟随产品）决定，`src/client/prefs.ts` 读出设置、解析「跟随产品」用的
`prefers-color-scheme`，再通知所有挂载点。

## 三、改哪里

**胶囊行**的变量声明在 `src/client/styles.ts` 的 `ROW_CSS` 顶部，挂在四个选择器上：
`[data-dsh-fast-pills="row"]`（胶囊行）、`[data-dsh-fast-pill-drawer]`（右侧抽屉）、
`[data-dsh-fast-pill-panel="card"]`（插件卡片那一节）、`.dfp-drawer-root`（抽屉外那层，
遮罩读的就是它上面的 `--dfp-mask-fill`）。三种改法，从轻到重：

1. **只改一套皮肤**：在页面上给这几个选择器覆盖 `--dfp-*`（浏览器里手改、或用别的插件注入
   一条样式）。
2. **改默认值**：动 `ROW_CSS` 顶部的默认值，`npm run build` 后刷新页面。
3. **换掉某个产品语义色的对应关系**：同上，把某一行的 `var(--dsw-...)` 换成别的语义色。

**面板**的变量在同一份文件里、胶囊行下面那一段，改法同上（第 2 节那张表就是它的默认值）。
深色那一组由 `[data-dfp-theme="dark"]` 给出，改浅色时别忘了它。

改完记得 `npm run build`：页面加载的是构建产物 `lib/client.js`，不是 `src/`。

## 注意

- 快速胶囊的底色是琥珀、字是深色：浅色主题下深色字靠 `--dsw-static-neutral-bluish-950`，
  深色主题下这个色仍然比琥珀底深得多，两种主题都读得清。
- 胶囊是全圆角，另外单独声明了 `corner-shape: round`：产品默认的 `superellipse(1.5)` 会把
  胶囊两端磨方；行首那颗圆形入口同样处理。面板里的胶囊选择器反过来：
  纸墨里没有圆角，`.dfp-drawer .dfp-pill` 与卡片那一节的同名规则把它压成直角。
- 面板里的按钮 / 输入 / 勾选框 / 标签 / Tab / 分段选择 / 确认框都是插件自己画的
  （`src/client/controls.tsx`），不读产品语义色，颜色取第 2 节那张表；只有两个东西还从产品那边
  借：对话框与抽屉的 Escape / Tab 归属（`useModalLayer`），以及遮罩的模糊（`--dsw-mask-blur`）。
- 滚动条也是纸墨：滑块用 `--dfp-rule-soft`、hover 时压成 `--dfp-ink`，直角无圆角，轨道透明。
  抽屉本身、胶囊选择器、台账列表、每日明细表这四处滚动的容器都按这套画。
- Banner 顶上那条走马灯水印是 `--dfp-ink` 的 7% 不透明度，字号与字距是固定的；`prefers-reduced-motion`
  下它不漂移。
- 胶囊行的键盘聚焦描边走页面的全局 `:focus-visible` 样式，不另声明；面板里的控件自己给一圈
  `2px var(--dfp-brand)`，仍然只在键盘聚焦时出现。
- 行首那颗计数圆按钮是**反色墨牌**：行自己的 token 块里多两支 `--dfp-invert-bg`（取
  `--dsw-alias-label-primary`）与 `--dfp-invert-ink`（取 `--dsw-alias-label-primary-inverted`），
  整排只有它反色，外圈 3px 是纸色、抽屉打开时换成 `--dfp-quick-fill`。
- 它旁边那颗 **⚡ 快捷新增**是一枚空心圆，和旁边的胶囊同高：边与字取**风格色彩**的深色那一支
  `--dfp-style-ink`（与圆牌同一支颜色），中间不填色。悬停的淡底由这支边色按 16% 混出来，
  而不是用它自带的 `--dfp-style-wash` —— 后者在没选风格色彩时是全透明的，用它这一格就
  没有任何反馈。它的悬浮说明是黑底白字的一小条，画在 `ROW_CSS` 里，不借浏览器自带的 `title`。
- 快速胶囊是**琥珀虚线 + 16% 琥珀底 + 墨色字**；普通胶囊是实线一像素；分组也是虚线（展开时只压深
  虚线、字加重）——「虚线 = 会自己发出去 / 是分组，实线 = 普通点一下」。
- 拖动排序的落点线是 `5px var(--dfp-ink)`（原来是 2px 的品牌蓝）：纸墨里强调用墨，蓝色留给
  图表那两色。「快速 / 普通」是 `1px var(--dfp-rule)` 的直角方框（快速那颗换成 `--dfp-quick`
  的边与字），「限定工作区」那排 chip 是圆头胶囊，同一支墨边。
- 台账与统计里的两色只看「快速 / 普通」这一维：`--dfp-quick` 直接读胶囊行那颗快速胶囊的
  `--dfp-quick-fill`，所以页面上的琥珀与面板里的琥珀永远是一支。热力格的 1–4 格是
  `color-mix()` 把 `--dfp-brand` 按 18% / 38% / 58% / 78% 混进 `--dfp-paper`，第 5 格就是
  本色；不额外给五个色号，改一个变量整条梯度跟着走。深浅直接画在格子的底上而不是叠一层子
  元素，否则今天那圈粗框会被子元素盖住。
