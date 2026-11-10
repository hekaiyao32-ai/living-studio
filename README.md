# He Kaiyao — Living Studio / Digital Archive

这是从现有公开网站导出的 GitHub → Cloudflare Pages 发布项目，保留原有七个页面与 Eastern mood 互动作品。作品在主页和 Project Title 中嵌入运行，列表标注为 Net Art 02。

当前状态：代码与发布配置已准备；GitHub 仓库和 Cloudflare Pages 账户尚未连接。现有 `chatgpt.site` 网站继续保留，不代表已经按课程完成 Cloudflare Pages 发布。

## 实际项目类型与构建设置

项目是已维护的 HTML/CSS/JavaScript 静态网站，不是 Vite/React。`dist/` 就是网站本体，必须提交到 Git；没有运行时服务器或必需的环境变量。

| Cloudflare Pages 项目设置 | 填写内容 |
| --- | --- |
| 创建类型 | Pages → Connect to Git / Import an existing Git repository |
| Framework preset | None |
| Production branch | main |
| Build command | npm run build |
| Build output directory | dist |
| Root directory | 留空，使用仓库根目录 |
| Environment variables | 不需要 |

`npm run build` 会验证静态页面、站内引用、当前作品脚本、模型文件与 Pages 文件大小限制；它不重新生成或清空 dist。项目没有第三方 npm 依赖。请勿使用 React 预设，也不要把 Root directory 填成 dist。

本地使用 Node.js 20 或更新版本：

```sh
npm run build
npm run dev
```

开发命令会提供 http://localhost:5173 。直接双击 HTML 文件不等于本地 HTTP 预览，模型和浏览器权限可能无法正常工作。

## 1. 上传到 GitHub

如果由当前 Codex 使用已连接的 GitHub 操作，应将这个项目推送到你明确选定的新仓库，并使用 main 分支。不要覆盖已有仓库，也不要改动原网站的 origin。

如果下载 ZIP 自己操作，先解压，再用 GitHub Desktop 将 `living-studio` 文件夹创建为本地仓库，然后 Publish repository 到自己的 GitHub。仓库名称可用 `living-studio-he-kaiyao`。没有现成远端时再添加 origin；不要重复 git init 或覆盖已有 origin。登录与授权在 GitHub Desktop / GitHub 浏览器页面完成。

ZIP 不包含 `.git`，从 ZIP 创建的仓库会从新的初始提交开始；当前准备工作区另外保留了原来的版本历史。不要把 ZIP 本身上传成仓库内容，应上传解压后的文件：根目录应能看到 package.json、scripts/、dist/。

`.gitignore` 已排除 node_modules、.env、密钥文件和工具缓存。dist 是当前维护的静态源码，不在忽略列表中。

## 2. 在 Cloudflare Pages 连接 GitHub

1. 登录 https://dash.cloudflare.com/ 。
2. 打开 Workers & Pages → Create application → Pages → Connect to Git（新界面可能称 Import an existing Git repository）。选择 Pages 的 Git 集成，而不是手动 Direct Upload 或 Workers 的部署流程。
3. 授权 Cloudflare 访问这次指定的 GitHub 仓库，选择该仓库和 main 分支。
4. 按上表填写设置并开始部署。项目名可用 `he-kaiyao-living-studio`，实际地址以 Cloudflare 返回为准。
5. 等待部署成功，记录实际 `https://….pages.dev` 地址与部署对应的 commit。

不需要购买域名，也不需要把 GitHub/Cloudflare 的密码或 API token 发给 Codex。

## 3. 验证课程要求

发布后，在项目目录运行：

```sh
npm run check:live -- https://你的实际项目.pages.dev
```

该命令验证主页、六个子页面、两个作品入口、直接访问内部路径、静态资源与模型、WASM MIME 类型、真实 404。它不会替代真实设备或摄像头测试。

另外亲自或请同学完成：

- 用无痕窗口和另一台设备打开公开地址，确认无需登录。
- 桌面、手机上查看导航、图片和布局；打开 Working Log 与 Net Art 02。
- 在作品中点击顶部摄像头按钮并授权：张手破碎与光波、握拳复原、伸指换色变形、移动手掌的拖尾与晃动；测试手动按钮与舒缓/静止模式。
- 修改一条 Working Log 记录，commit 并 push 到 main；确认 Cloudflare 自动触发新的成功部署，线上能看到那条修改。
- 保存 GitHub 仓库地址、Pages 地址、部署成功截图和提交历史，按老师要求提交。

本项目含真实 404 页面，避免找不到的图片被静默替换成首页。`dist/_headers` 指定 WASM MIME 与本站摄像头权限。

## 作品与内容说明

Eastern mood 默认使用本地 MediaPipe 模型；摄像头画面只在访问者浏览器中处理。可切换到原来的 Teachable Machine 模型；该可选模型仍从 Google 的模型地址加载，MediaPipe 默认模式不依赖它。

手势：张手破碎为不规则碎片星河并扩散光波；握拳复原；食指向上切换 16 套配色与 8 种形态；移动手掌产生流光与整体晃动。页面包含手动测试、摄像头关闭、光效开关及舒缓/静止观看选项。

网站保留第三方运行库的 LICENSE。原始网站说明见 ARCHIVE-NOTES.md。

## 协作权限

- GitHub：把另一位使用者的 GitHub 账号加入仓库协作者，对方 Codex 连接获授权的 GitHub 后继续编辑。
- Cloudflare：在账户成员中邀请对方，仅授予所需的 Pages 管理范围；实际角色名称以账户界面为准。只改代码且 Git push 自动发布时，通常无需对方获得 Cloudflare 账户管理权。
- 当前 Sites 网站：编辑协作与 GitHub 权限分开。同一工作区编辑者与外部访问者不是同一种权限，不能把公开链接当作编辑授权。

参考：
- https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/platform/limits/
