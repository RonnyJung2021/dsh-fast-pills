/**
 * The plugin's one stylesheet, as text.
 *
 * The shell builds its own styles with CSS Modules; a plugin bundle loaded
 * from `lib/client.js` has no such step, so the plugin carries its sheet and
 * installs it once (see {@link installStyles}).
 *
 * It draws two surfaces that no longer pretend to be the same one:
 *
 * - **The row** above the composer keeps the product's grammar — round
 *   capsules, semantic product tokens with a `--dfp-*` override seat in front
 *   of each — because it stands beside the composer's own controls
 *   (see `docs/colors.md`).
 * - **The panel** (the drawer and the plugin card) is drawn as paper and ink:
 *   a warm off-white sheet, pure black rules, square corners, monospaced
 *   figures. Its tokens are the panel's own (`--dfp-paper` … `--dfp-mono`) and
 *   come in a light and a dark set, swapped by the `data-dfp-theme` attribute
 *   the mounts put on their roots.
 */

/** Marker on the installed element, so the page and the checks can find it. */
export const STYLE_ELEMENT_ID = 'dsh-fast-pills-styles'

/** The stylesheet text. */
export const ROW_CSS = `
/* ══ 胶囊行（输入框上的那一排）：产品语法，不动 ══════════════════════════ */

[data-dsh-fast-pills="row"],
[data-dsh-fast-pill-drawer],
[data-dsh-fast-pill-panel="card"],
.dfp-drawer-root {
  /* Override seats: a skin re-points these, the rules below only read them. */
  --dfp-pill-fill: var(--dsw-alias-bg-layer-1);
  --dfp-pill-stroke: var(--dsw-alias-border-l2);
  --dfp-pill-label: var(--dsw-alias-label-primary);
  --dfp-pill-hover: var(--dsw-alias-interactive-bg-hover);
  --dfp-pill-quiet-label: var(--dsw-alias-label-secondary);
  --dfp-group-stroke: var(--dsw-alias-border-l2);
  --dfp-group-label: var(--dsw-alias-label-secondary);
  /* 四支颜色不选时的样子，与「主题与外观」里那四支默认色**同一支**（连派生值也一致）：
     卡片上看到的就是页面上画的，不会一个说 A 一个画 B。
     普通胶囊＝最先那支蓝 #0095FF，快速胶囊＝最先那支橙 #F59E0B。 */
  --dfp-plain-fill: #0095FF;
  --dfp-plain-ink: #0071C2;
  --dfp-plain-wash: rgba(0, 149, 255, 0.25);
  --dfp-quick-fill: #F59E0B;
  --dfp-quick-ink: #111111;      /* 万一要整块填橙时，那上面的字（外观卡里也列出来） */
  --dfp-quick-text: #9D6507;     /* 橙当字用时的深一档：淡橙底上的字、树里那些标记 */
  --dfp-quick-wash: rgba(245, 158, 11, 0.25);
  /* 行首那颗圆牌穿的是**风格色彩**那一支的深色版。 */
  --dfp-style-fill: transparent;
  --dfp-style-wash: #00000000;
  --dfp-style-ink: #695F77;
  /* 悬停时压深一档（深色纸上是提亮一档）：混的是**反色面**，两支纸上都还读得清。
     这里必须是一支在这一排里**定义过**的颜色——圆牌不在面板里，面板的 --dfp-ink 到不了这里，
     写了它整条 background 会在计算时作废，圆牌一悬停就变成透明的。 */
  --dfp-style-hover: color-mix(in srgb, var(--dfp-style-ink) 84%, var(--dfp-invert-bg));
  /* 计数用等宽：一位一格地翻，字宽不能随着数字变。 */
  --dfp-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --dfp-accent-ink: #0071C2;
  --dfp-accent-wash: rgba(0, 149, 255, 0.25);
  --dfp-accent-hover: #007DD6;
  --dfp-mask-fill: var(--dsw-alias-bg-mask-1);
  /* 反色：面板里「选中」那种整块反色用它，取产品自己的「反色面 / 反色字」两支。 */
  --dfp-invert-bg: var(--dsw-alias-label-primary);
  --dfp-invert-ink: var(--dsw-alias-label-primary-inverted);
}

[data-dsh-fast-pills="row"] {
  box-sizing: border-box;
  position: relative;   /* 展开的那一层以这一排为参照，好对齐到这一排的左边缘 */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 100%);
  margin: 0 auto;
}

/* The round entry that opens the drawer, wearing today's press count.
   它是这一排的统领：整排只有它是一枚**主题色（压深一档）的圆牌**——底是这一族的深色、
   字是这块底上读得清的那一支、外面再套一圈纸色留白，旁边那些浅色的胶囊因此都读成
   「它管着的东西」。比其他胶囊高一档（32px），点开的是抽屉。 */
[data-dsh-fast-pills="row"] .dfp-circle {
  box-sizing: border-box;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--dfp-style-ink);
  border-radius: 999px;
  corner-shape: round;
  background: var(--dfp-style-ink);
  border-color: var(--dfp-style-ink);
  /* 反色字：浅色主题下这一支是深的，深色主题下它是浅的——反色那支两边都读得清。 */
  color: var(--dfp-invert-ink);
  font: inherit;
  font-family: var(--dfp-mono);
  font-size: 12.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  /* 外面那一圈是纸色，把墨牌从旁边的胶囊里托出来；再一点点投影让它浮着。 */
  box-shadow: 0 0 0 3px var(--dfp-pill-fill), 0 1px 3px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition: box-shadow 0.16s ease, transform 0.16s ease;
}

[data-dsh-fast-pills="row"] .dfp-circle:hover {
  transform: translateY(-1px);
  background: var(--dfp-style-hover);
  border-color: var(--dfp-style-hover);
  box-shadow: 0 0 0 3px var(--dfp-pill-fill), 0 2px 6px rgba(0, 0, 0, 0.28);
}

/* 抽屉开着的时候，外圈换成风格色彩那支的淡底——这一排里它在管事。 */
[data-dsh-fast-pills="row"] .dfp-circle[aria-expanded="true"] {
  box-shadow: 0 0 0 3px var(--dfp-style-wash), 0 2px 6px rgba(0, 0, 0, 0.24);
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-fast-pills="row"] .dfp-circle { transition: none; }
  [data-dsh-fast-pills="row"] .dfp-circle:hover { transform: none; }
}

/* 今日次数：一位一格，像记分牌那样翻上来。
   每一格的高度就是行高，数字从下面转进来，翻完停在格子里。 */
[data-dsh-fast-pills="row"] .dfp-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

[data-dsh-fast-pills="row"] .dfp-count-cell {
  display: inline-block;
  min-width: 0.62em;
  height: 1em;
  overflow: hidden;
  text-align: center;
  animation: dfp-count-roll 0.42s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes dfp-count-roll {
  from { transform: translateY(-76%); opacity: 0.25; }
  to   { transform: translateY(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-fast-pills="row"] .dfp-count-cell { animation: none; }
}

/* The row's capsule: the product's round capsule, unchanged. */
[data-dsh-fast-pills="row"] .dfp-pill {
  box-sizing: border-box;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--dfp-pill-stroke);
  /* The product's superellipse would square off the capsule's ends. */
  border-radius: 999px;
  corner-shape: round;
  background: var(--dfp-pill-fill);
  color: var(--dfp-pill-label);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

[data-dsh-fast-pills="row"] .dfp-pill:hover {
  background: var(--dfp-pill-hover);
}

[data-dsh-fast-pills="row"] .dfp-pill:active {
  transform: translateY(0.5px);
}

/* 两种胶囊各有一支颜色（主题与外观里可换），配方和外观卡上的预览一模一样：
   ——普通胶囊：蓝的边 + 很淡的底 + 蓝的字；
   ——快速胶囊：橙的边 + 淡橙底 + 深橙的字。
   两颗都是**实线**（虚线那套语言只留给分组）；形状仍是胶囊（999px），不改方。 */
[data-dsh-fast-pills="row"] .dfp-pill[data-quick="false"] {
  border-color: color-mix(in srgb, var(--dfp-plain-fill) 46%, var(--dfp-pill-stroke));
  background: color-mix(in srgb, var(--dfp-plain-fill) 8%, var(--dfp-pill-fill));
  color: var(--dfp-plain-ink);
}

[data-dsh-fast-pills="row"] .dfp-pill[data-quick="false"]:hover {
  border-color: var(--dfp-plain-fill);
  background: var(--dfp-plain-wash);
}

[data-dsh-fast-pills="row"] .dfp-pill[data-quick="true"] {
  border-style: solid;   /* 实线：它是一颗胶囊，不是分组——虚线那套语言只留给分组 */
  border-color: var(--dfp-quick-fill);
  background: var(--dfp-quick-wash);
  color: var(--dfp-quick-text);
  font-weight: 600;
}

[data-dsh-fast-pills="row"] .dfp-pill[data-quick="true"]:hover {
  border-color: var(--dfp-quick-fill);
  background: color-mix(in srgb, var(--dfp-quick-fill) 34%, var(--dfp-pill-fill));
  color: var(--dfp-quick-text);
}

/* The group's label: dashed and unfilled, reading as the row's own control
   rather than another action. */
[data-dsh-fast-pills="row"] .dfp-group {
  box-sizing: border-box;
  display: inline-flex;
  flex: none;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border: 1px dashed var(--dfp-group-stroke);
  border-radius: 999px;
  corner-shape: round;
  background: none;
  color: var(--dfp-group-label);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}

[data-dsh-fast-pills="row"] .dfp-group:hover {
  background: var(--dfp-pill-hover);
}

/* 展开的分组仍然是虚线（虚线是「这是分组」的语言），但边框压深、字变实：
   展开着的那一个在三个分组里一眼认得出来，同时虚线 / 实线的规矩不会被展开状态打乱。 */
[data-dsh-fast-pills="row"] .dfp-group[aria-expanded="true"] {
  border-color: var(--dfp-group-label);
  color: var(--dfp-pill-label);
  font-weight: 600;
}

/* 分组是这一排里唯一有「里面」的一件：它自己还是普通的一格，展开的那一层浮在它
   **上方**（绝对定位，脱开文档流），所以
   ——这一排里其他胶囊一颗都不会挪位，行高也不变，也就不会连带滚动；
   ——分组按钮自己留在原地，鼠标不用追着它走就能再点一次收起来。 */
[data-dsh-fast-pills="row"] .dfp-group-wrap {
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
}

/* 展开的那一层：往上涨（贴着自己那格的下沿），但**从这一排的左边缘开始铺**——
   不跟着分组按钮的位置走，所以它不会因为按钮排在后面而被右边缘切掉，也不会把这一排
   撑宽。宽到内容为止，最多不超过这一排的宽度。 */
[data-dsh-fast-pills="row"] .dfp-group-body {
  box-sizing: border-box;
  position: absolute;
  left: calc(-1 * var(--dfp-fold-inset, 0px));
  bottom: 100%;
  z-index: 5;
  width: max-content;
  max-width: min(100vw - 32px, var(--dfp-fold-max, 720px));
  margin: 0 0 6px;
  padding: 4px 6px 4px 10px;
  /* 它是一块浮在上面的纸，不是这一排里的一条：纸色底 + 极淡的投影把它从页面内容上托起来，
     左侧那条竖线（在行内时表示「这些属于上一格」）在浮起来之后只会变成一根穿页面的线，删掉。 */
  background: var(--dfp-pill-fill);
  border-radius: 6px;
  box-shadow: 0 2px 10px var(--dfp-accent-wash), 0 0 0 1px var(--dfp-group-stroke);
  transform-origin: bottom left;
  animation: dfp-fold-up 0.2s ease-out;
}

[data-dsh-fast-pills="row"] .dfp-group-body-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0 2px;
  animation: dfp-fold-in 0.24s ease-out;
}

@keyframes dfp-fold-up {
  from { transform: scaleY(0.6) translateY(6px); opacity: 0; }
  to   { transform: scaleY(1) translateY(0); opacity: 1; }
}

@keyframes dfp-fold-in {
  from { transform: translateY(8px); opacity: 0.4; }
  to   { transform: translateY(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  [data-dsh-fast-pills="row"] .dfp-group-body,
  [data-dsh-fast-pills="row"] .dfp-group-body-inner { animation: none; }
}

[data-dsh-fast-pills="row"] .dfp-note {
  color: var(--dfp-pill-quiet-label);
  font-size: 12px;
  line-height: 18px;
}

/* ══ 面板：米白纸 + 纯黑墨 ══════════════════════════════════════════════ */

/* The panel's own paper. Two mounts and the portalled dialog carry it; the
   dialog is portalled to the body, so it cannot inherit from the panel. */
.dfp-drawer-root,
[data-dsh-fast-pill-panel="card"],
.dfp-dialog-root {
  /* 风格色彩给整张纸镀一层：填充默认透明，所以不选它就是原来那张纸。
     它的深色版（style-ink）给行首那颗圆牌当底。 */
  --dfp-style-fill: transparent;
  --dfp-style-wash: #00000000;
  --dfp-style-ink: #695F77;
  --dfp-paper: color-mix(in srgb, var(--dfp-style-fill) 10%, #FAF7F5);   /* 纸：面板底色 */
  --dfp-paper-2: color-mix(in srgb, var(--dfp-style-fill) 14%, #F3F0EF); /* 纸（凹一档）：轨道、表头、凹面 */
  --dfp-ink: #000000;            /* 墨：正文与所有分隔线 */
  --dfp-ink-2: rgba(0, 0, 0, 0.62);
  --dfp-ink-3: rgba(0, 0, 0, 0.40);
  --dfp-ink-num: #999999;        /* 序号栏的灰 */
  --dfp-rule: #000000;           /* 硬分隔线 */
  --dfp-rule-soft: rgba(0, 0, 0, 0.16);
  --dfp-invert-bg: #000000;      /* 悬浮 / 选中：整块反色 */
  --dfp-invert-ink: #FFFFFF;
  --dfp-scope-fill: #1E3A8A;     /* 限定标记那一支：藏青（主题与外观里可换） */
  --dfp-scope-ink: #1E3A8A;
  --dfp-scope-wash: rgba(30, 58, 138, 0.25);
  --dfp-brand: #0095FF;          /* 图表与图例的「普通」那一支＝普通胶囊的填充 */
  --dfp-accent-ink: #0071C2;     /* 普通胶囊那支：当字用、当抽屉入口那圈 */
  --dfp-accent-wash: rgba(0, 149, 255, 0.25);
  --dfp-accent-hover: #007DD6;
  --dfp-quick: var(--dfp-quick-fill);  /* 快速胶囊那一色 */
  --dfp-ok: #1F9D55;
  --dfp-err: #D92D20;
  --dfp-col: 84px;               /* 序号栏宽度 */
  --dfp-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

/* 深色：同一套语法翻转成黑纸白墨。 */
.dfp-drawer-root[data-dfp-theme="dark"],
[data-dsh-fast-pill-panel="card"][data-dfp-theme="dark"],
.dfp-dialog-root[data-dfp-theme="dark"] {
  --dfp-paper: color-mix(in srgb, var(--dfp-style-fill) 10%, #000000);
  --dfp-paper-2: color-mix(in srgb, var(--dfp-style-fill) 16%, #111111);
  --dfp-ink: #FFFFFF;
  --dfp-ink-2: rgba(255, 255, 255, 0.64);
  --dfp-ink-3: rgba(255, 255, 255, 0.42);
  --dfp-ink-num: #8A8A8A;
  --dfp-rule: #FFFFFF;
  --dfp-rule-soft: rgba(255, 255, 255, 0.20);
  --dfp-invert-bg: #FFFFFF;
  --dfp-invert-ink: #000000;
  --dfp-brand: #33ADFF;
  --dfp-ok: #3FB950;
  --dfp-err: #F85149;
}

/* ── 抽屉外壳 ─────────────────────────────────────────────────────────── */

.dfp-drawer-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.dfp-drawer-mask {
  position: absolute;
  inset: 0;
  background: var(--dfp-mask-fill);
  backdrop-filter: var(--dsw-mask-blur);
  animation: dfp-fade-in 160ms var(--ds-ease-in-out);
}

.dfp-drawer {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  /* A wide drawer, 85% of the page unless the reader's setting says otherwise. */
  width: var(--dfp-drawer-width, 85vw);
  height: 100%;
  padding: 12px 22px 48px;
  overflow-y: auto;
  border-left: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
  color: var(--dfp-ink);
  font-size: 13px;
  line-height: 1.6;
  animation: dfp-slide-in 180ms var(--ds-ease-in-out);
}

@keyframes dfp-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dfp-slide-in {
  from { transform: translateX(24px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .dfp-drawer-mask, .dfp-drawer, .dfp-dialog-mask, .dfp-dialog { animation: none; }
}

/* ── 面板：顶部 Tab 条 + 一列编号卡片 ─────────────────────────────────── */

.dfp-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dfp-tab-body {
  display: flex;
  flex-direction: column;
  /* A tab body is a banner, then a column of cards: the banner stands apart,
     and the cards below it share their edges. */
  gap: 20px;
}

/* 编号卡片的那一列：相邻两张共用一条边。 */
.dfp-stack {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── 每个 Tab 开头的 Banner：走马灯水印 + 大标题 + 右侧一个大数字 ──────── */

.dfp-hero {
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
  overflow: hidden;
}

.dfp-hero-pattern {
  padding: 10px 0;
  border-bottom: 1px solid var(--dfp-rule);
  overflow: hidden;
  white-space: nowrap;
  user-select: none;
}

.dfp-hero-pattern span {
  display: inline-block;
  color: var(--dfp-ink);
  font-family: var(--dfp-mono);
  font-size: 34px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.3em;
  opacity: 0.07;
  animation: dfp-drift 70s linear infinite;
}

@keyframes dfp-drift {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .dfp-hero-pattern span { animation: none; }
}

.dfp-hero-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}

.dfp-hero-lead {
  padding: 26px 28px 28px;
}

.dfp-eyebrow {
  margin: 0 0 12px;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.24em;
}

.dfp-hero-title {
  margin: 0;
  font-size: clamp(26px, 3vw, 36px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.02em;
}

.dfp-hero-desc {
  margin: 12px 0 0;
  max-width: 44em;
  color: var(--dfp-ink-2);
  font-size: 13px;
  line-height: 1.65;
}

.dfp-hero-figure {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 200px;
  padding: 26px 28px;
  border-left: 1px solid var(--dfp-rule);
  text-align: right;
}

.dfp-figure-key {
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
}

.dfp-figure-value {
  margin-top: 8px;
  font-family: var(--dfp-mono);
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.dfp-figure-state {
  margin-top: 10px;
  color: var(--dfp-ink-2);
  font-size: 11.5px;
}

/* 顶上两行：右上角一个方块叉号自己占一行，下面才是三个 Tab 那一条。
   面板顶上没有标题条——第一行只有这一个按钮。 */
.dfp-topbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dfp-close {
  box-sizing: border-box;
  align-self: flex-end;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
  color: var(--dfp-ink-2);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-close:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

/* 顶部一级 Tab：等分格子、共用边框、选中整块反色。 */
.dfp-tabs {
  display: flex;
  border: 1px solid var(--dfp-rule);
}

.dfp-tab {
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 0;
  padding: 13px 12px;
  border: none;
  border-right: 1px solid var(--dfp-rule);
  background: transparent;
  color: var(--dfp-ink-2);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-tab:last-child {
  border-right: none;
}

.dfp-tab:hover {
  background: var(--dfp-paper-2);
  color: var(--dfp-ink);
}

.dfp-tab[aria-selected="true"],
.dfp-tab[aria-selected="true"]:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

/* 编号卡片：相邻两张共用一条边，整屏读成一列横线。 */
.dfp-section {
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
}

.dfp-section + .dfp-section {
  margin-top: -1px;
}

.dfp-section-head {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--dfp-rule);
}

.dfp-section-index {
  flex: 0 0 var(--dfp-col);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px 0;
  border-right: 1px solid var(--dfp-rule);
  font-family: var(--dfp-mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--dfp-ink-num);
}

.dfp-section-title {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 18px 26px;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.dfp-section-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 26px 26px;
}

/* ── 自绘控件：直角、硬边框、悬浮整块反色 ─────────────────────────────── */

.dfp-btn {
  box-sizing: border-box;
  padding: 8px 16px;
  border: 1px solid var(--dfp-rule);
  background: transparent;
  color: var(--dfp-ink);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.dfp-btn:hover:not(:disabled) {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-btn:disabled {
  border-color: var(--dfp-rule-soft);
  color: var(--dfp-ink-3);
  cursor: not-allowed;
}

.dfp-btn[data-variant="primary"] {
  border-color: var(--dfp-invert-bg);
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-btn[data-variant="primary"]:hover:not(:disabled) {
  border-color: var(--dfp-rule);
  background: transparent;
  color: var(--dfp-ink);
}

.dfp-btn[data-variant="ghost"] {
  border-color: var(--dfp-rule-soft);
  color: var(--dfp-ink-2);
}

.dfp-btn[data-variant="ghost"]:hover:not(:disabled) {
  border-color: var(--dfp-rule);
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-btn:focus-visible,
.dfp-tab:focus-visible,
.dfp-choice-item:focus-visible,
.dfp-pill:focus-visible,
.dfp-ai-session-pick:focus-visible,
.dfp-close:focus-visible,
.dfp-dialog-close:focus-visible {
  outline: 2px solid var(--dfp-brand);
  outline-offset: 2px;
}

.dfp-input,
.dfp-body-input {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dfp-rule);
  border-radius: 0;
  background: var(--dfp-paper);
  color: var(--dfp-ink);
  font: inherit;
  font-family: var(--dfp-mono);
  font-size: 13px;
  font-weight: 600;
  outline: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-input::placeholder,
.dfp-body-input::placeholder {
  color: var(--dfp-ink-3);
  font-weight: 400;
}

/* 聚焦不反色：字还是那些字，只是框加粗一圈。用内阴影而不是加 border-width，
   免得聚焦时整个版面跟着挪一像素；颜色仍是墨色，不换成强调色。 */
.dfp-input:focus,
.dfp-body-input:focus,
.dfp-textarea:focus {
  background: var(--dfp-paper);
  color: var(--dfp-ink);
  box-shadow: inset 0 0 0 1px var(--dfp-ink);
}

.dfp-body-input {
  box-sizing: border-box;
  height: auto;
  min-height: 30px;
  padding: 4px 10px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.5;
  resize: vertical;
}

/* 勾选项：方形勾选框，选中整块反色。 */
.dfp-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border: 1px solid var(--dfp-rule);
  color: var(--dfp-ink);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-check:hover {
  background: var(--dfp-paper-2);
}

.dfp-check[data-on="true"],
.dfp-check[data-on="true"]:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-check input {
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
  margin: 0;
  border: 1px solid var(--dfp-ink);
  border-radius: 0;
  background: transparent;
  cursor: pointer;
}

.dfp-check input:checked {
  background: var(--dfp-ink);
}

.dfp-check input:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid var(--dfp-paper);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.dfp-check[data-on="true"] input {
  border-color: var(--dfp-invert-ink);
}

.dfp-check[data-on="true"] input:checked {
  background: var(--dfp-invert-ink);
}

.dfp-check[data-on="true"] input:checked::after {
  border-color: var(--dfp-invert-bg);
}

/* ── 插件卡片：一枚开关 + 一页使用说明 ─────────────────────────────────── */

.dfp-card {
  display: flex;
  flex-direction: column;
  margin: 16px 0;
}

/* 开关：一条直角轨道加一枚滑块，开着的时候轨道填墨、滑块换成纸色。 */
.dfp-switch {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
  cursor: pointer;
  user-select: none;
}

.dfp-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.dfp-switch-track {
  position: relative;
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 42px;
  height: 22px;
  margin-top: 1px;
  border: 1px solid var(--dfp-ink);
  background: transparent;
  transition: background-color 0.2s ease;
}

.dfp-switch-knob {
  position: absolute;
  left: 2px;
  top: 2px;
  width: 16px;
  height: 16px;
  background: var(--dfp-ink);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.dfp-switch[data-on="true"] .dfp-switch-track {
  background: var(--dfp-ink);
}

.dfp-switch[data-on="true"] .dfp-switch-knob {
  background: var(--dfp-paper);
  transform: translateX(20px);
}

.dfp-switch input:focus-visible + .dfp-switch-track {
  outline: 2px solid var(--dfp-ink);
  outline-offset: 2px;
}

.dfp-switch-words {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dfp-switch-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

/* 使用说明：一句话带路，三个入口各配一张图，图下写它是什么。 */
.dfp-guide {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: -1px;
  padding: 22px 20px 24px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
}

.dfp-guide-lead {
  margin: 0;
  color: var(--dfp-ink-2);
  font-size: 13px;
  line-height: 1.7;
}

.dfp-guide-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}

.dfp-guide-shot {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: auto;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
}

.dfp-guide-words {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dfp-guide-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.dfp-guide-body {
  color: var(--dfp-ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

.dfp-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--dfp-rule-soft);
  border-radius: 0;
  color: var(--dfp-ink-2);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.dfp-tag[data-tone="info"] { border-color: var(--dfp-plain-fill); color: var(--dfp-plain-ink); }
.dfp-tag[data-tone="warning"] {
  border-color: var(--dfp-quick-fill);
  background: var(--dfp-quick-wash);
  color: var(--dfp-quick-text);
}
.dfp-tag[data-tone="success"] { border-color: var(--dfp-ok); color: var(--dfp-ok); }
.dfp-tag[data-tone="danger"] { border-color: var(--dfp-err); color: var(--dfp-err); }

/* 一行互斥选择：共用边框，选中整块反色。 */
.dfp-choice {
  display: inline-flex;
  border: 1px solid var(--dfp-rule);
}

.dfp-choice-item {
  padding: 8px 18px;
  border: none;
  border-right: 1px solid var(--dfp-rule);
  background: transparent;
  color: var(--dfp-ink-2);
  font: inherit;
  font-family: var(--dfp-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-choice-item:last-child {
  border-right: none;
}

.dfp-choice-item:hover:not(:disabled) {
  background: var(--dfp-paper-2);
  color: var(--dfp-ink);
}

.dfp-choice-item[aria-pressed="true"],
.dfp-choice-item[aria-pressed="true"]:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-choice-item:disabled {
  color: var(--dfp-ink-3);
  cursor: not-allowed;
}

/* ── 确认框 ───────────────────────────────────────────────────────────── */

.dfp-dialog-root {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.dfp-dialog-mask {
  position: absolute;
  inset: 0;
  background: var(--dfp-mask-fill);
  backdrop-filter: var(--dsw-mask-blur);
  animation: dfp-fade-in 160ms var(--ds-ease-in-out);
}

.dfp-dialog {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: min(420px, 100%);
  padding: 22px 24px 24px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
  color: var(--dfp-ink);
  box-shadow: var(--dsw-elevation-prominent);
  animation: dfp-fade-in 160ms var(--ds-ease-in-out);
}

.dfp-dialog-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dfp-dialog-title {
  flex: 1 1 auto;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.dfp-dialog-close {
  padding: 0 6px;
  border: none;
  background: none;
  color: var(--dfp-ink-2);
  font: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.dfp-dialog-close:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-dialog-note {
  margin: 0;
  color: var(--dfp-ink-2);
  font-size: 12.5px;
  line-height: 1.65;
}

.dfp-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

/* 滚动条也走纸墨：一条细灰轨上的实心滑块，hover 时压成墨色、直角。 */
.dfp-drawer,
.dfp-ledger-list,
.dfp-stats-table-wrap,
.dfp-ai-records {
  scrollbar-width: thin;
  scrollbar-color: var(--dfp-rule-soft) transparent;
}

.dfp-drawer::-webkit-scrollbar,
.dfp-ledger-list::-webkit-scrollbar,
.dfp-stats-table-wrap::-webkit-scrollbar,
.dfp-ai-records::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.dfp-drawer::-webkit-scrollbar-thumb,
.dfp-ledger-list::-webkit-scrollbar-thumb,
.dfp-stats-table-wrap::-webkit-scrollbar-thumb,
.dfp-ai-records::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 0;
  background: var(--dfp-rule-soft);
  background-clip: padding-box;
}

.dfp-drawer::-webkit-scrollbar-thumb:hover,
.dfp-ledger-list::-webkit-scrollbar-thumb:hover,
.dfp-stats-table-wrap::-webkit-scrollbar-thumb:hover,
.dfp-ai-records::-webkit-scrollbar-thumb:hover {
  background: var(--dfp-ink);
  background-clip: padding-box;
}

.dfp-drawer::-webkit-scrollbar-track,
.dfp-ledger-list::-webkit-scrollbar-track,
.dfp-stats-table-wrap::-webkit-scrollbar-track,
.dfp-ai-records::-webkit-scrollbar-track {
  background: transparent;
}

/* ── 一段说明文字 ─────────────────────────────────────────────────────── */

.dfp-quiet {
  margin: 0;
  color: var(--dfp-ink-2);
  font-size: 12px;
  line-height: 1.65;
}

/* ── 一格一段的字段表：设置页的通用、AI 页的表单都用它 ────────────────── */

/* 表格：左边一列字段名，右边控件；控件下面还能再跟一行说明。 */
.dfp-fields {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dfp-rule);
}

.dfp-fields .dfp-field + .dfp-field {
  border-top: 1px solid var(--dfp-rule);
}

.dfp-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
}

.dfp-field-label {
  flex: 0 0 auto;
  min-width: 7.5em;
  color: var(--dfp-ink-2);
  font-size: 12.5px;
  white-space: nowrap;
}

/* 控件那一栏：默认占满剩下的地方，输入框与它下面的说明竖着叠。 */
.dfp-field-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 一个分段选择这种小控件不进 .dfp-field-body 的左边，贴右边停。 */
.dfp-field-body > .dfp-choice {
  align-self: flex-end;
}

.dfp-field-note {
  color: var(--dfp-ink-2);
  font-size: 11.5px;
  line-height: 1.6;
}

/* 直接摆在 .dfp-field 里的输入控件也占满那一栏。 */
.dfp-field > .dfp-input,
.dfp-field > .dfp-body-input {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}

/* 设置页：左边一条分节栏，右边是这一节自己的 Banner 与卡片。
   栏占满这一页的高度，所以整页读起来是「导航 + 内容」，而不是一长条往下拖。 */
.dfp-split {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  align-items: stretch;
}

.dfp-side {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--dfp-rule);
}

.dfp-side-item {
  padding: 12px 18px;
  border: none;
  border-top: 1px solid var(--dfp-rule-soft);
  background: transparent;
  color: var(--dfp-ink-2);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-side-item:first-child {
  border-top: none;
}

.dfp-side-item:hover {
  background: var(--dfp-paper-2);
  color: var(--dfp-ink);
}

.dfp-side-item[aria-current="true"],
.dfp-side-item[aria-current="true"]:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-side-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  padding-left: 22px;
}

/* ── 胶囊选择器：与输入框上那排胶囊同一颗，换成纸墨的样子 ─────────────── */

/* 胶囊选择器是一张表：第一行第一列空着，第一行第二列是全部一级胶囊；
   从第二行起，左边一栏是分组的名字，右边是组里的胶囊。
   高过几行就自己滚，胶囊再多也不会把下面的图挤出屏幕。 */
/* 这张表该多高就多高：不再封顶、也不再自己滚——它是选胶囊用的，一屏里看完比滚着找省事。 */
.dfp-picker-table {
  display: block;
  border: 1px solid var(--dfp-rule);
  border-collapse: collapse;
  width: 100%;
}

.dfp-picker-row + .dfp-picker-row {
  border-top: 1px solid var(--dfp-rule-soft);
}

.dfp-picker-who {
  width: 1%;
  padding: 10px 14px;
  border-right: 1px solid var(--dfp-rule-soft);
  color: var(--dfp-ink);
  font-family: var(--dfp-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

/* 第一行是表头，左栏没有内容，所以连那条竖线也不必画。 */
.dfp-picker-row[data-picker-row="top"] .dfp-picker-who {
  padding: 0;
  border-right: none;
}

/* 第一行按表头读：一层很浅的底，和下面折叠的行分开。 */
.dfp-picker-row[data-picker-row="top"] {
  background: var(--dfp-paper-2);
}

.dfp-picker-what {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  vertical-align: top;
}

/* 一行胶囊前面的小字：这一格装的是什么。 */
.dfp-picker-what-note {
  flex: none;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
}

.dfp-drawer .dfp-pill,
[data-dsh-fast-pill-panel="card"] .dfp-pill {
  box-sizing: border-box;
  display: inline-flex;
  flex: none;
  align-items: center;
  height: auto;
  padding: 4px 11px;
  border: 1px solid var(--dfp-plain-fill);
  border-radius: 0;   /* 表格里的这些是「格子」，保持原来的纯矩形 */
  background: transparent;
  color: var(--dfp-plain-ink);
  font: inherit;
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.7;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.dfp-drawer .dfp-pill:hover,
[data-dsh-fast-pill-panel="card"] .dfp-pill:hover {
  background: var(--dfp-plain-wash);
  color: var(--dfp-plain-ink);
}

/* 快速胶囊：橙的边 + 一层淡橙底 + 那一支深橙的字；不整块填色，填色只留给聊天框那排。 */
.dfp-drawer .dfp-pill[data-quick="true"],
[data-dsh-fast-pill-panel="card"] .dfp-pill[data-quick="true"] {
  border-color: var(--dfp-quick-fill);
  background: var(--dfp-quick-wash);
  color: var(--dfp-quick-text);
}

.dfp-drawer .dfp-pill[data-quick="true"]:hover,
[data-dsh-fast-pill-panel="card"] .dfp-pill[data-quick="true"]:hover {
  background: color-mix(in srgb, var(--dfp-quick-fill) 34%, var(--dfp-pill-fill));
  color: var(--dfp-quick-text);
}

/* 选中那颗整块反色；写在快速之后，琥珀那颗的边与字才盖得住。 */
.dfp-drawer .dfp-pill[aria-pressed="true"],
.dfp-drawer .dfp-pill[aria-pressed="true"]:hover,
[data-dsh-fast-pill-panel="card"] .dfp-pill[aria-pressed="true"],
[data-dsh-fast-pill-panel="card"] .dfp-pill[aria-pressed="true"]:hover {
  border-color: var(--dfp-invert-bg);
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

/* ── 今日胶囊台账：指标带 + 24 小时时间线 + 序号列表 ──────────────────── */

/* 指标带：一格一条竖线，标签在上、数字在下，两列基线对齐。 */
.dfp-ledger-stats {
  display: flex;
  flex-wrap: wrap;
  border: 1px solid var(--dfp-rule);
}

.dfp-ledger-stat {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 10px;
  padding: 12px 18px;
  border-right: 1px solid var(--dfp-rule);
}

.dfp-ledger-stat:last-child {
  border-right: none;
}

.dfp-ledger-stat-label {
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--dfp-ink-3);
  white-space: nowrap;
}

.dfp-ledger-stat-value {
  font-family: var(--dfp-mono);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--dfp-ink);
}

/* 台账上这两个数字比「当字用」的一般场合亮一档：它们是 16px 粗体，用不着压那么深，
   深的那一版在纸上发褐，看着脏。这里只往墨里混一成，颜色随读者挑的那一支走。 */
.dfp-ledger-stat[data-tone="quick"] .dfp-ledger-stat-value {
  color: color-mix(in srgb, var(--dfp-quick-fill) 88%, var(--dfp-ink));
}

.dfp-ledger-stat[data-tone="plain"] .dfp-ledger-stat-value {
  color: color-mix(in srgb, var(--dfp-plain-fill) 88%, var(--dfp-ink));
}

/* 24 小时时间线：扁平实色块，无圆角无光晕。 */
.dfp-ledger-timeline {
  position: relative;
}

.dfp-ledger-track {
  position: relative;
  height: 30px;
  overflow: hidden;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
}

.dfp-ledger-seg {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 3px;
  background: var(--dfp-brand);
  box-shadow: 0 0 0 1px var(--dfp-paper);
  cursor: pointer;
  transition: filter 0.12s ease;
}

.dfp-ledger-seg[data-quick="true"] {
  background: var(--dfp-quick);
}

/* 高亮的一对：线上的色块与下面那一行。 */
.dfp-ledger-seg[data-hover="true"] {
  filter: brightness(1.2);
  outline: 2px solid var(--dfp-ink);
  outline-offset: -2px;
}

.dfp-ledger-tip {
  position: absolute;
  bottom: calc(100% + 10px);
  z-index: 2;
  padding: 7px 11px;
  transform: translateX(-50%);
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
  font-family: var(--dfp-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}

.dfp-ledger-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 7px;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}

.dfp-stats-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: var(--dfp-ink-2);
  font-size: 11.5px;
}

.dfp-stats-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.dfp-stats-dot {
  display: inline-block;
  box-sizing: border-box;
  width: 11px;
  height: 11px;
  border: 1px solid var(--dfp-rule);
}

.dfp-stats-dot[data-quick="true"] { background: var(--dfp-quick); }
.dfp-stats-dot[data-quick="false"] { background: var(--dfp-brand); }

/* 当天的记录：一行一条，序号在左、目录在右，悬浮整行反色。 */
.dfp-ledger-list {
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--dfp-rule);
  list-style: none;
}

.dfp-ledger-row {
  display: grid;
  grid-template-columns: var(--dfp-col) minmax(0, 1fr) auto;
  align-items: center;
  border-bottom: 1px solid var(--dfp-rule);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-ledger-row:last-child {
  border-bottom: none;
}

.dfp-ledger-row:hover,
.dfp-ledger-row[data-hover="true"] {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-ledger-index {
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border-right: 1px solid var(--dfp-rule);
  color: var(--dfp-ink-num);
  font-family: var(--dfp-mono);
  font-size: 12.5px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.dfp-ledger-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px 16px;
}

.dfp-ledger-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dfp-ledger-dot {
  flex: none;
  box-sizing: border-box;
  width: 10px;
  height: 10px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-brand);
}

.dfp-ledger-dot[data-quick="true"] {
  background: var(--dfp-quick);
}

.dfp-ledger-tail {
  padding: 12px 18px;
  color: var(--dfp-ink-2);
  font-family: var(--dfp-mono);
  font-size: 12px;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.dfp-ledger-row:hover .dfp-ledger-index,
.dfp-ledger-row[data-hover="true"] .dfp-ledger-index,
.dfp-ledger-row:hover .dfp-ledger-tail,
.dfp-ledger-row[data-hover="true"] .dfp-ledger-tail {
  color: var(--dfp-invert-ink);
}

/* 空态不吃悬浮：没有记录可指。 */
.dfp-ledger-empty {
  padding: 14px 16px;
  color: var(--dfp-ink-2);
  font-size: 12px;
  cursor: default;
}

/* ── 胶囊使用趋势统计 ─────────────────────────────────────────────────── */

/* 区间与胶囊：第二行不套格子，左边三个 Tab，右边翻页那一串。 */
.dfp-rangebar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.dfp-rangebar-pager {
  display: flex;
  align-items: stretch;
  margin-left: auto;
  border: 1px solid var(--dfp-rule);
}

.dfp-rangebar-pager .dfp-btn {
  border: none;
  border-right: 1px solid var(--dfp-rule);
}

.dfp-rangebar-pager .dfp-btn:last-child {
  border-right: none;
  border-left: 1px solid var(--dfp-rule);
}

.dfp-rangebar-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 9em;
  padding: 0 14px;
  font-family: var(--dfp-mono);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

/* 区间概览：与台账指标带同一套「一格一条竖线」的表格带。 */
.dfp-stats-metrics {
  display: flex;
  flex-wrap: wrap;
  border: 1px solid var(--dfp-rule);
}

.dfp-stats-metric {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 10px;
  padding: 12px 18px;
  border-right: 1px solid var(--dfp-rule);
}

.dfp-stats-metric:last-child {
  border-right: none;
}

.dfp-stats-metric-label {
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--dfp-ink-3);
  white-space: nowrap;
}

.dfp-stats-metric-value {
  font-family: var(--dfp-mono);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--dfp-ink);
}

.dfp-stats-metric[data-tone="up"] .dfp-stats-metric-value { color: var(--dfp-plain-ink); }
.dfp-stats-metric[data-tone="down"] .dfp-stats-metric-value { color: var(--dfp-err); }

/* 每日柱状图：左边一栏刻度、右边画柱子，底下一排「月-日」。
   刻度是按整数挑的，所以柱子的高度可以直接对着横线读出来。 */
.dfp-stats-chart {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
}

.dfp-stats-gutter {
  position: relative;
  min-width: 2.8em;
  border-right: 1px solid var(--dfp-rule-soft);
}

/* 每个刻度贴在它那条横线下面：最高那一格才不会顶出图框。 */
.dfp-stats-gutter-tick {
  position: absolute;
  right: 8px;
  transform: translateY(100%);
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.dfp-stats-bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 178px;
}

/* 一条刻度一条横线，画在柱子后面。 */
.dfp-stats-gridline {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid var(--dfp-rule-soft);
}

.dfp-stats-bar {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  height: 100%;
  padding: 0 3px;
  cursor: pointer;
}

/* 普通那截在下、快速那截叠在上面，两截合起来才是这一天的次数。 */
.dfp-stats-bar-fill {
  box-sizing: border-box;
  width: 100%;
  max-width: 46px;
  border: 1px solid var(--dfp-ink);
  border-bottom: none;
  background: var(--dfp-brand);
  transition: filter 0.12s ease;
}

.dfp-stats-bar-quick {
  background: var(--dfp-quick);
}

.dfp-stats-bar-normal {
  border-bottom: 1px solid var(--dfp-ink);
}

/* 一条记录都没有的那天不画柱子。0 高度还留着边框的话，border-box 会被撑到
   边框那么高，底色跟着描出一条线；所以边框和底色一起收掉。 */
.dfp-stats-bar[data-count="0"] .dfp-stats-bar-fill {
  border: none;
  background: transparent;
}

.dfp-stats-bar:hover .dfp-stats-bar-fill,
.dfp-stats-bar[data-hover="true"] .dfp-stats-bar-fill {
  filter: brightness(1.15);
  outline: 2px solid var(--dfp-ink);
  outline-offset: -2px;
}

/* 日期那一行只在柱子下面（第 2 栏），左边刻度栏底下留空。 */
.dfp-stats-axis {
  grid-column: 2;
  display: flex;
  border-top: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
}

.dfp-stats-axis .dfp-stats-tick {
  flex: 1 1 0;
  min-width: 0;
  padding: 5px 0;
  overflow: hidden;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  text-align: center;
  white-space: nowrap;
}

.dfp-stats-axis .dfp-stats-tick[data-today="true"] {
  color: var(--dfp-ink);
  font-weight: 700;
}

/* 日历热力格：一格一天，颜色深浅 = 当天按了几次。 */
.dfp-heat-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dfp-stats-heat {
  border: 1px solid var(--dfp-rule);
}

.dfp-stats-heat-head,
.dfp-stats-heat-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.dfp-stats-heat-head {
  border-bottom: 1px solid var(--dfp-rule);
}

.dfp-stats-heat-head span {
  padding: 7px 0;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-align: center;
}

.dfp-stats-heat-grid {
  gap: 1px;
  padding: 1px;
  background: var(--dfp-rule-soft);
}

.dfp-stats-heat-cell {
  position: relative;
  box-sizing: border-box;
  min-height: 56px;
  padding: 6px 7px;
  overflow: hidden;
  background: var(--dfp-paper);
  cursor: pointer;
}

/* 不在这一区间里的格子：只画纸，不画数。 */
.dfp-stats-heat-cell[data-blank="true"] {
  background: var(--dfp-paper-2);
  cursor: default;
}

/* 深浅直接画在格子的底上，而不是叠一层子元素：今天那圈粗框要压在颜色上面，
   而绝对定位的子元素会盖住父元素的 outline。 */
.dfp-stats-heat-cell[data-level="1"] { background-color: color-mix(in srgb, var(--dfp-brand) 18%, var(--dfp-paper)); }
.dfp-stats-heat-cell[data-level="2"] { background-color: color-mix(in srgb, var(--dfp-brand) 38%, var(--dfp-paper)); }
.dfp-stats-heat-cell[data-level="3"] { background-color: color-mix(in srgb, var(--dfp-brand) 58%, var(--dfp-paper)); }
.dfp-stats-heat-cell[data-level="4"] { background-color: color-mix(in srgb, var(--dfp-brand) 78%, var(--dfp-paper)); }
.dfp-stats-heat-cell[data-level="5"] { background-color: var(--dfp-brand); }

.dfp-stats-heat-day {
  position: relative;
  display: block;
  color: var(--dfp-ink-2);
  font-family: var(--dfp-mono);
  font-size: 11px;
}

.dfp-stats-heat-value {
  position: relative;
  display: block;
  margin-top: 3px;
  color: var(--dfp-ink);
  font-family: var(--dfp-mono);
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dfp-stats-heat-cell[data-today="true"],
.dfp-stats-heat-cell:not([data-blank="true"]):hover {
  outline: 2px solid var(--dfp-ink);
  outline-offset: -2px;
}

.dfp-stats-heat-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--dfp-ink-2);
  font-size: 11.5px;
}

.dfp-stats-heat-scale {
  display: inline-flex;
}

.dfp-stats-heat-scale .dfp-stats-heat-cell {
  min-height: 0;
  width: 16px;
  height: 12px;
  padding: 0;
  border: 1px solid var(--dfp-rule-soft);
  cursor: default;
}

.dfp-stats-heat-key {
  margin-left: auto;
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--dfp-ink-3);
}

/* 每日明细：与台账同一套序号行语法，末尾多两列。 */
.dfp-stats-table-wrap {
  max-height: 400px;
  overflow: auto;
  border: 1px solid var(--dfp-rule);
}

.dfp-stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

.dfp-stats-table thead th {
  padding: 9px 14px;
  border-bottom: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-align: left;
}

.dfp-stats-table tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--dfp-rule);
  color: var(--dfp-ink);
}

.dfp-stats-table tbody tr:last-child td {
  border-bottom: none;
}

.dfp-stats-table tbody tr:hover {
  background: var(--dfp-invert-bg);
}

.dfp-stats-table tbody tr:hover td {
  color: var(--dfp-invert-ink);
}

.dfp-stats-table .dfp-stats-date {
  font-weight: 600;
  white-space: nowrap;
}

.dfp-stats-table .dfp-stats-count {
  font-family: var(--dfp-mono);
  text-align: right;
}

/* ── 设置页的胶囊树 ───────────────────────────────────────────────────── */

.dfp-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 13px;
}

.dfp-editor-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.dfp-tree {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dfp-rule);
}

.dfp-row-wrap,
.dfp-group-wrap {
  display: flex;
  flex-direction: column;
}

.dfp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-top: 1px solid var(--dfp-rule);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-tree > :first-child > .dfp-row,
.dfp-tree > .dfp-row:first-child {
  border-top: none;
}

.dfp-row:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

/* 分组那一行垫一层凹面：一行深、一行浅，一眼分出「这是一个容器」和「这是一颗胶囊」。
   组里的胶囊仍然留在纸色上，所以深的那几行就是分组。 */
.dfp-row-group {
  background: var(--dfp-paper-2);
}

.dfp-row-group:hover {
  background: var(--dfp-invert-bg);
}

.dfp-row-grip {
  color: var(--dfp-ink-3);
  cursor: grab;
}

/* 展开 / 收起那颗箭头：转过去、转回来，让「点了它」看得出来。 */
.dfp-row-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  padding: 0;
  border: none;
  background: none;
  color: var(--dfp-ink-3);
  font: inherit;
  font-family: var(--dfp-mono);
  cursor: pointer;
  transition: transform 0.18s ease;
}

.dfp-row-toggle[aria-expanded="true"] {
  transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
  .dfp-row-toggle { transition: none; }
}

/* 行上点空白也有用：分组开合、胶囊开合自己的编辑，让手看得出来这里能点。 */
.dfp-row-group,
.dfp-row-pill {
  cursor: pointer;
}

/* 名字与正文那两处仍然是字：点它们是想改字，不是想开合。 */
.dfp-row .dfp-name,
.dfp-row .dfp-row-quiet {
  cursor: text;
}

.dfp-row-name {
  font-weight: 600;
}

/* 分组名后面那一段「（6）」：就是一截字，跟着名字读，不占一个控件的宽度。 */
.dfp-row-count {
  flex: none;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 11.5px;
}

/* 「限定：…」那一枚标记有自己的一支颜色（主题与外观里可换），点一下就去改这一条的限定。 */
.dfp-scope-preview {
  cursor: default;
}

.dfp-scope-tag {
  flex: none;
  max-width: 22em;
  overflow: hidden;
  padding: 2px 8px;
  border: 1px solid var(--dfp-scope-fill);
  border-radius: 0;
  background: var(--dfp-scope-wash);
  color: var(--dfp-scope-ink);
  font: inherit;
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.dfp-scope-tag:hover {
  border-color: var(--dfp-scope-fill);
}

/* 悬停到那一行时，它只是把同一支颜色压实一点：边框用填充色、底用淡底，字始终是同族深色。
   它**不能**用反色：纸色底上写反色字等于把字擦掉（这一版早先就是这样，被截图逮到了）。 */
.dfp-row:hover .dfp-scope-tag {
  border-color: var(--dfp-scope-fill);
  background: var(--dfp-scope-wash);
  color: var(--dfp-scope-ink);
}

.dfp-scope-preview {
  cursor: default;
}

.dfp-row-quiet {
  max-width: 340px;
  overflow: hidden;
  color: var(--dfp-ink-2);
  font-family: var(--dfp-mono);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dfp-row-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.dfp-row-actions .dfp-btn {
  padding: 5px 12px;
  font-size: 11.5px;
  letter-spacing: 0.06em;
}

/* 反色的那一行里，字、标签、按钮一起翻转。 */
.dfp-row:hover .dfp-row-grip,
.dfp-row:hover .dfp-row-toggle,
.dfp-row:hover .dfp-row-name,
.dfp-row:hover .dfp-row-quiet {
  color: var(--dfp-invert-ink);
}

.dfp-row:hover .dfp-tag {
  border-color: var(--dfp-invert-ink);
  color: var(--dfp-invert-ink);
}

.dfp-row:hover .dfp-btn {
  border-color: var(--dfp-invert-ink);
  background: transparent;
  color: var(--dfp-invert-ink);
}

.dfp-row:hover .dfp-btn:hover:not(:disabled) {
  background: var(--dfp-invert-ink);
  color: var(--dfp-invert-bg);
}

.dfp-group-children {
  display: flex;
  flex-direction: column;
  margin-left: var(--dfp-col);
  border-left: 1px solid var(--dfp-rule);
}

.dfp-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px 20px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
}

/* 树里的表单是接着上一行写的，三条边留给树本身。 */
.dfp-tree .dfp-form {
  border-top: 1px solid var(--dfp-rule);
  border-right: none;
  border-bottom: none;
  border-left: none;
}

/* 名字就地可改：平时是字，悬停时露出将来那个输入框的边，双击就把边填实。 */
.dfp-name {
  border: 1px solid transparent;
  padding: 2px 6px;
  margin: -2px -6px;
  cursor: text;
}

.dfp-row:hover .dfp-name {
  border-color: var(--dfp-invert-ink);
}

.dfp-name-input {
  width: auto;
  min-width: 8em;
  max-width: 16em;
  padding: 2px 6px;
  font-weight: 600;
}

/* 快速 / 普通：和纸墨里其他标签一样是一只方框，边框与字色分出两种胶囊。
   同一个形状，只有颜色在说「这一颗会自己发出去」。 */
/* 树里的「普通 / 快速」标记走和预览一模一样的那套：同族的边、同族的字，
   快速那颗再多一层淡底。悬停只把边压实，**不许用反色**（纸底白字＝看不见）。 */
.dfp-row-kind {
  flex: none;
  padding: 3px 9px;
  border: 1px solid var(--dfp-plain-fill);
  border-radius: 0;   /* 树里的标记是「盖的章」，纯矩形 */
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  background: transparent;
  color: var(--dfp-plain-ink);
}

.dfp-row-kind[data-quick="true"] {
  border-color: var(--dfp-quick-fill);
  background: var(--dfp-quick-wash);
  color: var(--dfp-quick-text);
}

.dfp-row:hover .dfp-row-kind {
  background: var(--dfp-plain-wash);
}

.dfp-row:hover .dfp-row-kind[data-quick="true"] {
  background: var(--dfp-quick-wash);
}

/* 拖动时那一条粗线：整页唯一的强调色是墨，落点也用墨说，不用蓝。 */
.dfp-dropline {
  height: 5px;
  margin: 0;
  background: var(--dfp-ink);
}

/* 胶囊要落进来的那一组：整组亮起来，并让出一格给它。 */
.dfp-group-wrap[data-drop-into="true"] > .dfp-row-group {
  box-shadow: inset 0 0 0 2px var(--dfp-ink);
}

.dfp-group-wrap[data-drop-into="true"] > .dfp-group-children {
  border-left-color: var(--dfp-ink);
}

/* 分组底那一行浅色提示已经收进树下面的 Tips 区块（见 .dfp-tips）。 */

.dfp-group-scope {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--dfp-rule-soft);
  background: var(--dfp-paper-2);
}

/* 紧凑的表单：一屏里看得到自己刚填了什么，不用来回滚。 */
/* 紧凑的表单：一颗胶囊就三件事，一行里并排问完；这个框只占一条，不占一屏。 */
/* 紧凑的表单：三行问完一颗胶囊，标签各占左边一栏（和设置页其他字段同一套排法）。 */
.dfp-form-compact {
  gap: 8px;
  padding: 10px 12px 11px;
}

.dfp-form-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

/* 名字那一行：名字输入框按内容定宽、快速自发送跟在后面，两者都不许被压。 */
.dfp-form-first {
  align-items: center;
}

.dfp-form-first .dfp-check {
  margin-left: 4px;
}

.dfp-input-name {
  flex: none;
  width: 12em;
}

/* 限定工作区那一行：标签左边一栏，chip 与说明在右边那一栏里竖着排。 */
.dfp-form-scope-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 正文那一格：输入框在上面，打一个斜杠挑出来的一列贴在它下面。 */
.dfp-slash-box {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dfp-slash-list {
  display: flex;
  flex-direction: column;
  margin: 6px 0 0;
  padding: 0;
  max-height: 190px;
  overflow-y: auto;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
  list-style: none;
}

.dfp-slash-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 12px;
  border: none;
  background: none;
  color: var(--dfp-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dfp-slash-item:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-slash-name {
  font-family: var(--dfp-mono);
  font-size: 12px;
  font-weight: 600;
}

.dfp-slash-note {
  color: var(--dfp-ink-3);
  font-size: 11px;
}

.dfp-slash-item:hover .dfp-slash-note {
  color: var(--dfp-invert-ink);
}

/* 限定工作区：一排可选的工作区，水墨胶囊那支笔——圆头、一像素墨边，
   选中的整块反色；一个都不选就是不受限制。 */
.dfp-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dfp-scope-chip {
  max-width: 22em;
  overflow: hidden;
  padding: 5px 12px;
  border: 1px solid var(--dfp-rule);
  border-radius: 999px;
  corner-shape: round;
  background: var(--dfp-paper);
  color: var(--dfp-ink-2);
  font: inherit;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.dfp-scope-chip:hover {
  border-color: var(--dfp-ink);
  color: var(--dfp-ink);
}

.dfp-scope-chip[aria-pressed="true"] {
  border-color: var(--dfp-invert-bg);
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

/* 树下面的 Tips：整棵树的手势在这里说一次。 */
.dfp-tips {  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--dfp-rule-soft);
  background: var(--dfp-paper-2);
}

.dfp-tips-title {
  font-family: var(--dfp-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--dfp-ink);
}

.dfp-tips-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding-left: 1.6em;
  color: var(--dfp-ink-2);
  font-size: 11.5px;
  line-height: 1.7;
}

.dfp-form-actions,
.dfp-cleanup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

/* 表单底部那一行压紧：它只是「新建 / 取消」加一句小字。 */
/* 表单里的标签栏窄一点：这一段字段名都很短，留白给输入框。 */
.dfp-form-compact .dfp-field-label {
  flex: none;
  min-width: 4.5em;
}

.dfp-form-compact .dfp-form-actions {
  gap: 8px;
}

/* 正文框：默认约四行高，仍可自己拉高。 */
.dfp-form-compact .dfp-body-input {
  min-height: 4.4em;
}

/* 自定义提示词那一段是「写东西」的地方，给它一块真正能写的高度。 */
.dfp-prompt-input {
  min-height: 12em;
}

/* 转圈：模型分析时按钮左边那一枚。边框上留一段空白，转起来就是进度。
   带转圈的按钮自己改成一行 flex：图标与文字垂直居中对齐，中间留 8px。 */
.dfp-btn:has(.dfp-spinner) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dfp-spinner {
  display: inline-block;
  flex: none;
  width: 11px;
  height: 11px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 999px;
  vertical-align: middle;
  animation: dfp-spin 0.7s linear infinite;
}

@keyframes dfp-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .dfp-spinner { animation: none; opacity: 0.7; }
}

/* ── 主题与外观：每支颜色一张卡，卡里是一条色带加它的派生值 ─────────────── */

.dfp-color-card {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 14px 16px;
  border-top: 1px solid var(--dfp-rule);
}

.dfp-color-card:first-child {
  border-top: none;
}

.dfp-color-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.dfp-color-title {
  color: var(--dfp-ink);
  font-size: 13px;
  font-weight: 600;
}

.dfp-color-note {
  color: var(--dfp-ink-3);
  font-size: 11.5px;
}

/* 一枚色块：这一支自己的色相转出来的那几枚，选中的套一圈墨边。 */
.dfp-color-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dfp-accent-chip {
  box-sizing: border-box;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--dfp-rule-soft);
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.14s ease;
}

.dfp-accent-chip:hover {
  transform: translateY(-1px);
}

.dfp-accent-chip[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--dfp-paper), 0 0 0 3px var(--dfp-ink);
}

/* 「默认」不是一种颜色，是一句话：清掉这一支就回到这一版自带的那支。 */
.dfp-accent-default {
  box-sizing: border-box;
  flex: none;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--dfp-rule-soft);
  border-radius: 8px;
  background: var(--dfp-paper);
  color: var(--dfp-ink-2);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}

.dfp-accent-default[aria-pressed="true"] {
  border-color: var(--dfp-ink);
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-accent-input {
  width: 9em;
  height: 28px;
  font-family: var(--dfp-mono);
  font-size: 11.5px;
}

/* 色带：从这一支的深端走到浅端，四段连成一条。 */
.dfp-ramp {
  display: flex;
  height: 14px;
  overflow: hidden;
  border: 1px solid var(--dfp-rule-soft);
  border-radius: 7px;
}

.dfp-ramp > span {
  flex: 1;
}

/* 派生值：一枚色片 + 名字 + 色号（文字色那一项还报对比度）。 */
.dfp-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.dfp-swatch-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dfp-ink-2);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
}

.dfp-swatch-name {
  color: var(--dfp-ink-3);
  font-family: inherit;
}

.dfp-swatch-ratio {
  color: var(--dfp-ink-3);
}

.dfp-swatch-chip {
  width: 14px;
  height: 14px;
  border: 1px solid var(--dfp-rule-soft);
  border-radius: 4px;
}

/* 预览：用派生出来的那几个值本身画一遍，所以它和面板画出来的东西不会走样。 */
.dfp-accent-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--dfp-rule-soft);
  background: var(--dfp-paper-2);
}

.dfp-accent-preview-block {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-right: 14px;
  border-right: 1px solid var(--dfp-rule-soft);
}

/* 风格色彩那一格：纸、凹面、以及镀了色之后浮起来的一层。 */
.dfp-accent-preview-sheet {
  width: 84px;
  height: 22px;
  border: 1px solid var(--dfp-rule-soft);
  background: linear-gradient(
    90deg,
    var(--dfp-paper) 0 33%,
    var(--dfp-paper-2) 33% 66%,
    color-mix(in srgb, var(--dfp-style-fill) 26%, var(--dfp-paper)) 66% 100%
  );
}

.dfp-accent-preview-label {
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
}

.dfp-accent-preview-note {
  color: var(--dfp-ink-3);
  font-size: 11.5px;
}

/* ── ⚡Super Pillls：识别那一页 ───────────────────────────────────────── */

/* 这一页底部那条话：成功是灰的，被拒绝的是红的——不填 key 就点识别，得一眼看出为什么。 */
.dfp-ai-notice {
  margin: 0;
  color: var(--dfp-ink-2);
  font-size: 12.5px;
  line-height: 1.65;
}

.dfp-ai-notice[data-ai-notice="failed"] {
  color: var(--dfp-err);
}

/* API key 那一行：输入框吃掉剩下的宽度，同步 / 清空两颗按钮贴右边。 */
.dfp-key-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dfp-key-row .dfp-input {
  flex: 1 1 auto;
  min-width: 0;
}

.dfp-key-row .dfp-btn {
  flex: none;
}

/* 取样参数那一折：默认收起，标题右边顺带报出现在的 temperature；
   它排在自定义提示词下面，展开也不把上面的字段挤走。 */
.dfp-more {
  border: 1px solid var(--dfp-rule-soft);
  background: var(--dfp-paper-2);
}

.dfp-more-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  padding: 9px 12px;
  color: var(--dfp-ink);
  font-size: 12.5px;
  cursor: pointer;
  list-style: none;
}

.dfp-more-summary::before {
  content: '▸';
  color: var(--dfp-ink-3);
  font-size: 10px;
}

.dfp-more[open] .dfp-more-summary::before {
  content: '▾';
}

.dfp-more-now {
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 11px;
}

.dfp-more .dfp-field-note,
.dfp-more-fields {
  margin: 0;
  padding: 0 12px 12px;
}

.dfp-more-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 推理这一档会改写下面三支参数的脾气：这句比普通注释再浅一档、再小半号，并且排在它们**上面**——
   读者先读到「temperature 不生效」，再去改数字。 */
.dfp-more-caveat {
  margin: -4px 12px 12px;
  padding: 6px 10px;
  border-left: 2px solid var(--dfp-rule-soft);
  color: var(--dfp-ink-3);
  font-size: 11px;
}

/* 用之前那四件事：一排紧凑的说明，放在这一页最上面。 */
.dfp-ai-disclaimer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
}

.dfp-ai-disclaimer-title {
  color: var(--dfp-ink);
  font-family: var(--dfp-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.dfp-ai-disclaimer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding-left: 1.4em;
  color: var(--dfp-ink-2);
  font-size: 12px;
  line-height: 1.6;
}

/* 最下方那条脚注：许可与责任，比正文轻。 */
.dfp-ai-footnote {
  margin: 4px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--dfp-rule-soft);
  color: var(--dfp-ink-3);
  font-size: 11.5px;
  line-height: 1.6;
}

/* 这一页的开场一句：说清它有什么能力。 */
.dfp-ai-intro {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--dfp-rule-soft);
  background: var(--dfp-paper-2);
  color: var(--dfp-ink-2);
  font-size: 12.5px;
  line-height: 1.7;
}

.dfp-ai-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dfp-ai-session {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dfp-ai-session-arrow {
  flex: none;
  display: inline-block;
  width: 1em;
  color: var(--dfp-ink-3);
  font-size: 10px;
  line-height: 1;
  transition: transform 0.18s ease;
}

.dfp-ai-session-arrow[data-open="true"] {
  transform: rotate(90deg);
}

.dfp-ai-session-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding: 9px 14px;
  border: 1px solid var(--dfp-rule);
  border-radius: 0;
  background: transparent;
  color: var(--dfp-ink);
  font: inherit;
  font-family: var(--dfp-mono);
  font-size: 11.5px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dfp-ai-session-pick:hover {
  background: var(--dfp-paper-2);
}

.dfp-ai-session-pick[aria-pressed="true"],
.dfp-ai-session-pick[aria-pressed="true"]:hover {
  background: var(--dfp-invert-bg);
  color: var(--dfp-invert-ink);
}

.dfp-ai-session-pick[aria-pressed="true"] .dfp-ai-session-arrow {
  color: var(--dfp-invert-ink);
}

@media (prefers-reduced-motion: reduce) {
  .dfp-ai-session-arrow { transition: none; }
}

.dfp-ai-suggestion {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper-2);
}

.dfp-ai-suggestion-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

/* 一条建议里的一个字段：标签在上，值在下，和胶囊表单同一套排法。 */
.dfp-ai-suggestion-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* 名字是这条建议在按钮上的字，比正文重一档。 */
.dfp-ai-suggestion-field .dfp-row-name {
  font-size: 14px;
}

/* 发出去之前的全文预览：一段一块，块与块之间用小标题与一条细线隔开。 */
.dfp-ai-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dfp-ai-preview-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dfp-ai-preview-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dfp-ai-preview-heading {
  margin: 0;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--dfp-rule);
  color: var(--dfp-ink);
  font-family: var(--dfp-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.dfp-ai-preview-part {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dfp-ai-preview-label {
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

/* 会话记录：点开一条会话之后逐条列出来。 */
.dfp-ai-session-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dfp-ai-records {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0 0 4px;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--dfp-rule);
  list-style: none;
}

.dfp-ai-record {
  display: grid;
  grid-template-columns: 11em minmax(0, 1fr);
  gap: 12px;
  padding: 9px 12px;
  border-top: 1px solid var(--dfp-rule-soft);
}

.dfp-ai-record:first-child {
  border-top: none;
}

.dfp-ai-record-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  color: var(--dfp-ink-3);
  font-family: var(--dfp-mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.7;
}

.dfp-ai-record-text {
  color: var(--dfp-ink);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.dfp-ai-prompt {
  box-sizing: border-box;
  margin: 0;
  max-height: 220px;
  padding: 12px 14px;
  overflow: auto;
  border: 1px solid var(--dfp-rule);
  background: var(--dfp-paper);
  color: var(--dfp-ink);
  font-family: var(--dfp-mono);
  font-size: 11.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.dfp-field-stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

/* 建议里的两个字都由读者定：名字是一段窄输入框，正文是可拉高的等宽文本域，
   和胶囊表单那两格同一支笔，只是排在一块建议里。 */
.dfp-ai-name {
  width: 14em;
  min-width: 0;
}

.dfp-ai-body-input {
  width: 100%;
  min-height: 30px;
  font-family: var(--dfp-mono);
  font-size: 11.5px;
}

/* ── 插件卡片：同一个面板，另一处挂载点 ───────────────────────────────── */

[data-dsh-fast-pill-panel="card"] {
  display: block;
  margin: 4px 0 8px;
  padding: 16px;
  background: var(--dfp-paper);
  color: var(--dfp-ink);
}

/* 窄容器里把序号栏与内边距一起收窄，版面不至于被挤散。 */
@media (max-width: 900px) {
  .dfp-drawer-root,
  [data-dsh-fast-pill-panel="card"],
  .dfp-dialog-root {
    --dfp-col: 56px;
  }

  .dfp-section-title {
    padding: 16px 16px;
    font-size: 17px;
  }

  .dfp-section-body {
    padding: 20px 16px 22px;
  }

  .dfp-hero-top {
    grid-template-columns: 1fr;
  }

  /* 窄容器里分节栏改横排，仍排在内容上面。 */
  .dfp-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .dfp-side {
    flex-direction: row;
    flex-wrap: wrap;
    border-right: none;
    border-bottom: 1px solid var(--dfp-rule);
  }

  .dfp-side-item {
    flex: 1 1 auto;
    border-top: none;
    border-left: 1px solid var(--dfp-rule-soft);
    text-align: center;
  }

  .dfp-side-item:first-child {
    border-left: none;
  }

  .dfp-side-body {
    padding: 20px 0 0;
  }

  .dfp-hero-figure {
    border-top: 1px solid var(--dfp-rule);
    border-left: none;
    text-align: left;
  }

  .dfp-hero-lead,
  .dfp-hero-figure {
    padding: 20px 16px 22px;
  }

  /* 窄容器里字段名不再占一栏，改回上下叠。 */
  .dfp-field {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .dfp-field-label {
    min-width: 0;
  }
}
`

/**
 * Install the stylesheet, once per page, and keep it current.
 *
 * The page can run several rows (the main conversation and an embedded one), so
 * the sheet is keyed by {@link STYLE_ELEMENT_ID} and only the first caller adds
 * the element. **Its text is rewritten on every call**, because a browser half
 * that is re-applied without a page reload — which is what a client-plugin hot
 * reload does — would otherwise keep drawing whatever sheet the first load
 * installed, and every class added since would render unstyled.
 * @param document - the page document to install into.
 * @returns the style element the page now holds.
 */
export function installStyles(document: Document): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID)
  const element = existing instanceof HTMLStyleElement ? existing : document.createElement('style')
  if (!(existing instanceof HTMLStyleElement)) {
    element.id = STYLE_ELEMENT_ID
    document.head.append(element)
  }
  element.textContent = ROW_CSS
  return element
}
