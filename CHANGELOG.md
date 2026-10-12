# Changelog

## [0.2.0] - 2026-10-12

- 新增「快捷新增胶囊」：点击胶囊行首的 ⚡ 圆钮，即以输入框中的文字与当前工作区打开新建胶囊表单，新胶囊置于胶囊列表首位。
  Quick add: the ⚡ at the head of the row opens the new-capsule form with the composer's draft and the current workspace already in it, and the capsule lands first in the row.
- 新增：新建胶囊表单拆分为独立组件，设置页、分组内新建与该圆钮共用。
  The new-capsule form is now one component, mounted by the settings page, a fold and the ⚡.
- 优化：分组展开层改为居中于分组胶囊正上方，并随该排宽度向左右扩展，撑满后自动换行。
  A fold is now centred on its own group and grows to the row's width before it wraps.
- 优化：分组展开层在点击其他区域或组内胶囊后自动收起。
  A fold closes again on any press outside it, or on a capsule inside it.

## [0.1.1] - 2026-10-11

- 优化：两份 README 中的配图改为绝对地址引用，在 npm 包页面上亦能正常显示。
  The images in both READMEs are fetched by absolute URL, so they render on the npm package page as well as on GitHub.

## [0.1.0] - 2026-10-11

首个版本，功能与用法见 [README](README.md)。

- 胶囊行：把常用说法存成胶囊排在输入框上方，点击即插入草稿；支持快速自发送、分组、限定工作区与拖动排序。
- 抽屉：今日点击台账、胶囊使用趋势统计、胶囊树编辑与界面设置；另有米白纸与纯黑墨两套主题、四支可换的颜色与中英双语界面。
- ⚡Super Pillls：由 DeepSeek 读取会话记录，给出经确认后入树的胶囊建议。

The first release; what it does and how to use it is in the [README](README.md).

- The row: stored wordings above the composer, one press inserts them, with quick send, folds, workspace limits and drag to reorder.
- The drawer: today's ledger, usage trends, the capsule tree editor and the settings, plus paper-and-ink light and dark themes, four repaintable colour families and a Chinese/English interface.
- ⚡Super Pillls: DeepSeek reads the session records and suggests capsules that join the tree only once confirmed.
