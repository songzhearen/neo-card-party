# Neo Card Party

[英文说明文档](docs/README_EN.md)

一个仿照经典 UNO 玩法制作的网页联机卡牌游戏。项目采用明快、粗边框、高对比度的新丑风视觉，把“出牌、摸牌、喊牌、联机房间、玩家资料、商城、邮件、排行榜、管理后台”等模块整理成一个可以本地运行、可以继续扩展的完整示例。

> 说明：本项目为学习与作品展示用途，不是官方 UNO 产品，也与相关商标权利方无关联。公开使用时建议替换为你自己的原创名称、图标和宣传文案。

![游戏主界面](docs/images/home.png)

## 项目特点

- 仿照 UNO 的核心出牌体验：颜色、数字、功能牌、万能牌、回合流转和结算。
- 支持本地游玩与联机房间，前端只负责交互展示，联机状态由服务端维护。
- 新丑风 UI：粗描边、硬阴影、强色块、像素风按钮与轻松玩梗的界面文案。
- 独立管理后台：用于管理用户数据、邮件、兑换码、排行榜奖励等运营内容。
- 账号与持久化数据：玩家资料、金币、背包、称号、邮件、好友、排行榜等均走服务端接口。
- `shared` 公共协议包：前后端共用类型与纯规则辅助函数，降低联机和单机逻辑混乱的风险。

## 技术栈

- 前端：Vite、TypeScript、原生 DOM/CSS。
- 服务端：Node.js、Express、TypeScript。
- 联机框架：[Colyseus](https://colyseus.io/)：第三方实时多人游戏框架，用于房间管理、WebSocket 通信和状态同步。
- 数据库：MariaDB / MySQL。
- 测试：Vitest。
- 项目结构：npm workspaces 风格的 monorepo。

## 第三方项目标注

- `apps/server/package.json` 依赖 `colyseus` 和 `@colyseus/schema`。
- `apps/web/package.json` 依赖 `colyseus.js`。
- 服务端入口使用 Colyseus `Server`，游戏房间继承 Colyseus `Room`。
- 前端通过 Colyseus 客户端创建、加入和重连联机房间。

## 目录结构

```text
apps/
  web/       玩家侧网页游戏
  server/    HTTP API 与 Colyseus 实时游戏服务端
  admin/     独立 GM / 管理后台
packages/
  shared/    前后端共享协议、类型和规则辅助函数
docs/
  images/    README 截图与文档图片
```

## 快速开始

安装依赖：

```powershell
npm install
```

构建项目：

```powershell
npm run build
```

运行测试：

```powershell
npm run test
```

分别启动服务端、玩家前端和管理后台：

```powershell
npm run dev:server
npm run dev:web
npm run dev:admin
```

## 环境变量

根目录提供了 `.env.example`，里面只保留占位配置。部署前请复制为目标环境需要的配置文件，并替换所有 `change-me` 和 `replace-with-*` 值。

常见配置：

```text
VITE_API_BASE=https://api.example.com/api
VITE_WS_URL=wss://api.example.com
ADMIN_API_BASE=https://api.example.com/api
DB_NAME=card_party
DB_USER=card_party_user
DB_PASSWORD=change-me
ROOT_BOOTSTRAP_PASSWORD=change-me
```

生产环境不要使用默认密码，不要提交真实 `.env` 文件。

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [部署说明](docs/DEPLOYMENT.md)
- [Shared 包说明](packages/shared/README.md)
- [Shared 发布说明](packages/shared/RELEASE.md)

## 公开发布建议

这份公共版适合作为学习项目、作品集项目或二次开发起点。正式公开前建议再确认：

- 项目名称、图标、宣传图和域名是否为原创。
- 截图、音乐、字体、图片素材是否有公开使用权限。
- `.env`、数据库备份、token、私钥、真实域名没有被提交。
- 管理后台不要裸奔，至少在域名、反向代理、平台权限或 VPN 层增加访问限制。

## 许可证

本公共版本使用 MIT License。请根据你的实际素材授权、商标策略和发布范围自行确认最终开源许可。
