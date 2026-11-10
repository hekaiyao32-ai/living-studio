# 发布交接说明

用户目标：严格按课件完成 Local project → GitHub → Cloudflare Pages → public HTTPS URL，测试内部路径刷新、图片模型、手机桌面、Working Log 与 Net Art 02、一次新 Git push 的自动重新部署。

目前已完成：
- 现有 Sites 网站与互动作品此前已经公开发布：
  https://he-kaiyao-digital-archive-2026.xinranbai518.chatgpt.site/
- 本目录是独立的 Cloudflare 发布副本，保留页面与最新作品。
- 已配置 build/check:live/dev 脚本、.gitignore、404、WASM headers。
- 页面中的 Net Art 02 对应 Eastern mood；新增日志只记录准备阶段，没有假称 Pages 已上线。
- 本副本从已有 Git 仓库复制，原站 origin 未改；副本已移除原 origin，等待明确的 GitHub 目标。

待用户操作/确认：
- GitHub 连接，选择属于用户的目标仓库。
- Cloudflare 登录并授权 GitHub 仓库，按 README 设置 Pages。
- 真实摄像头/另一台设备测试。

尚未完成：GitHub 推送、Cloudflare Pages 项目创建与上线、pages.dev 链接、Git push 自动重新部署验证。不要把 Sites 的已发布地址算作完成这条课程流程。

继续工作：先查看 README，检查当前 Git 状态/远端/分支。根据有效授权同步目标仓库，保留既有内容。Pages 发布后运行 check:live，并在 Working Log 如实记录 URL/提交/实测结果。

从 ZIP 解压时不含 .git；从当前准备工作区继续则保留历史。不要重复初始化已有仓库或覆盖原站远端。所有账户密码与 token 只使用服务的正常授权机制，不能写入仓库或要求在聊天中发送。
