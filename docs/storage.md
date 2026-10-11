# 存储与路由

面向要读代码或排查问题的人：胶囊树、使用流水、会话记录与会话凭据各落在哪个文件，页面又通过哪些路由读写它们。README 的 [存储](../README.md#存储) 一节只讲到「数据在本机、删目录即清空」这一层。

## 落点

`$DSH_HOME/storages/dsh-fast-pills/`（`$DSH_HOME` 未设时为 `~/.dsh`）：

| 文件 | 内容 |
| --- | --- |
| `pills.json` | 胶囊树，整份读、整份写 |
| `usage.jsonl` | 使用流水，一行一次，只追加，历史行永不改写（首次追加时才出现） |
| `transcripts.json` | 会话记录，整份读、整份写，一个会话一段、每段最多 200 条 |
| `settings.json` | 自定义提示词、DeepSeek 的模型 / 端点与取样参数，以及通用偏好（主题 / 语言 / 快速胶囊延时 / 抽屉宽度 / 是否显示胶囊行 / 四支颜色）；**不放 key** |
| `secret.json` | 插件自己那份 DeepSeek API key，权限 0600，只有本机进程读得到 |

删掉这个目录即为彻底清空。几个文件都可能是坏的，且都不至于让插件挂掉：

- 读不动的 `pills.json` 会被改名留档（`pills.json.bak-<时间戳>`）、改由种子启动，那一行的 `x-dsh-fast-pills-degraded` 响应头写着备份文件名；
- `usage.jsonl` 的坏行只跳过那一行；
- `transcripts.json` 里坏掉的会话整段丢掉、其余照常；
- 读不动的 `settings.json` 一律按默认值。

## 路由

宿主半一条前缀路由 `/dsh-fast-pills`，浏览器半只认这个前缀。

| 路由 | 作用 |
| --- | --- |
| `GET /dsh-fast-pills/pills` | 读胶囊树（首次读取写出种子） |
| `PUT /dsh-fast-pills/pills` | 整份写胶囊树；形状不对答 400 `invalid-tree` |
| `DELETE /dsh-fast-pills/pills` | 把胶囊重置为默认：删掉文件、写出种子，并把种子当回答体 |
| `GET /dsh-fast-pills/usage?from=&to=` | 读一段流水，两端都是闭区间 |
| `POST /dsh-fast-pills/usage` | 追加一条使用记录（`at` 缺省由宿主盖章），答 201 |
| `DELETE /dsh-fast-pills/usage` | 清空使用流水：删掉整个 `usage.jsonl` |
| `POST /dsh-fast-pills/transcript` | 记一条用户输入（落盘前遮一遍），答 201 与该会话的条数 |
| `GET /dsh-fast-pills/transcripts` | 列出有记录的会话（会话 id、条数、最后一条时间） |
| `GET /dsh-fast-pills/transcript?session=` | 读一个会话的记录（已是遮过的） |
| `DELETE /dsh-fast-pills/transcript?session=` | 清掉一个会话的记录 |
| `DELETE /dsh-fast-pills/transcripts` | 清空整份记录 |
| `GET /dsh-fast-pills/settings` | 读自定义提示词、DeepSeek 路由与通用偏好 |
| `PUT /dsh-fast-pills/settings` | 写上面那几项，逐字段校验，越界值不落盘 |
| `GET /dsh-fast-pills/credentials` | 只报「配没配 / 能不能写 / 能不能同步 / 来源 / 指纹」，**从不返回值** |
| `PUT /dsh-fast-pills/credentials` | 把手填的 key 写进本机凭据；只读层挡着时答 409 |
| `POST /dsh-fast-pills/credentials/sync` | 把 `$DSH_HOME/.credentials.yaml` 里的 `DEEPSEEK_API_KEY` 读出来、**在宿主这一边**写进插件自己的 `secret.json`；DSH 里没有就答 409 `no-harness-credential` |
| `POST /dsh-fast-pills/credentials/clear` | 删掉插件自己的 key 文件（没存过也答成功），答最新的事实 |
| `POST /dsh-fast-pills/recognize` | 遮一遍整份请求后调 DeepSeek，返回结构化建议；没配 key 答 409 `no-credential` |
| `POST /dsh-fast-pills/recognize/preview` | 只组装、不发送，供面板在发送前展示将要发出的全文 |
| `GET /dsh-fast-pills/asset/<名字>.png` | 插件卡片上的配图；名字是一张写死的清单（`row` / `drawer` / `recognize`），请求里的路径不参与读文件 |

## 数据形状

一级是数组，`kind` 区分 `pill` 与 `group`，组里只放胶囊、最多两级。每颗胶囊是 `id / name / body / skill / quick / scope`：

- `skill` 为 `null` 表示纯文字，有值表示插入 `/Skill名 body `；
- `quick` 为真表示插入后约一秒自发送；
- `scope` 是一串**路径**，命中的目录（含其子目录）才显示这颗胶囊，空数组表示处处显示；老文件里写的目录名按名字匹配，仍然有效。

流水一行是 `at / pillId / workspace / session`，`at` 是 ISO 8601 瞬时时间，归属哪一天由读取时按本机时区算。记录一条是 `at / text / workspace`，`text` 是**已经遮过**的文本。

## 写入纪律

整份写先写同目录临时文件再原子替换；追加写只 `append`；一个 store 的所有操作排在同一条队列上，宿主半是唯一写者。设置页那两个清理动作与记录的清理是这两条习惯的唯一例外，它们各删掉一整个文件（胶囊树回到种子、流水整个没了、记录整个没了）。客户端也把几种写排在同一条队列上，一次只发一个写请求。

种子写在 [`src/shared/constants/seedCapsules.ts`](../src/shared/constants/seedCapsules.ts)，只有三个例子：一级上放一颗「继续」（快速，点一下就发），「常用」组装另外两颗，不附带任何属于某个人的胶囊。名字与正文走 i18n，所以用英文重置得到的是英文例子；id 不翻译——流水按 id 指胶囊。
