# 部署说明

本文档描述一套通用部署模型。所有域名、密码和 bootstrap 口令都是占位示例，实际部署前必须替换。

## 域名规划

```text
https://game.example.com   -> 静态玩家前端
https://api.example.com    -> Node.js 服务端
https://admin.example.com  -> 静态管理后台
```

玩家前端和管理后台可以部署到 CDN 或静态托管平台。服务端建议部署到自己的服务器、容器平台或云服务，并通过 HTTPS 反向代理暴露。

## 服务端环境变量

```text
NODE_ENV=production
PORT=2567
CLIENT_ORIGIN=https://game.example.com,https://admin.example.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=card_party
DB_USER=card_party_user
DB_PASSWORD=replace-with-a-strong-password
DB_AUTO_CREATE=false
DB_AUTO_MIGRATE=true
ROOT_BOOTSTRAP_PASSWORD=replace-with-a-strong-bootstrap-password
```

构建并启动服务端：

```powershell
npm install
npm run build
npm run start -w card-party-server
```

生产环境中建议使用进程管理器或容器编排工具托管服务端进程，并将日志输出到平台日志系统。

## 玩家前端环境变量

```text
VITE_API_BASE=https://api.example.com/api
VITE_WS_URL=wss://api.example.com
```

构建玩家前端：

```powershell
npm install
npm run build -w card-party-web
```

将 `apps/web/dist` 发布到静态托管平台。

## 管理后台环境变量

管理后台是静态应用，通过服务端 API 登录和操作数据。

```text
ADMIN_API_BASE=https://api.example.com/api
```

建议在平台、反向代理或 VPN 层限制 `https://admin.example.com` 的访问范围。不要只依赖前端隐藏入口来保护管理功能。

## 数据库

不要在生产环境使用 `root` 账号。建议创建独立数据库和独立用户：

```sql
CREATE DATABASE card_party CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'card_party_user'@'%' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON card_party.* TO 'card_party_user'@'%';
FLUSH PRIVILEGES;
```

上线前请确认数据库已经备份，并确认迁移脚本不会破坏现有数据。

## 发布检查清单

- 运行 `npm run build`。
- 运行 `npm run test`。
- 检查 `/api/health`。
- 确认 `CLIENT_ORIGIN` 与实际玩家前端、管理后台域名一致。
- 确认没有提交真实 `.env`、token、私钥、数据库密码或生产域名。
- 确认管理后台域名有额外访问限制。
- 确认数据库账号不是 `root`，密码不是示例密码。
