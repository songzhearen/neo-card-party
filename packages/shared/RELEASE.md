# Shared 包发布说明

`@card-party/shared` 是公共 monorepo 的内部包。玩家前端和服务端通过本地路径依赖它：

```json
"@card-party/shared": "file:../../packages/shared"
```

## 本地开发

在仓库根目录运行：

```powershell
npm install
npm run build -w @card-party/shared
npm run test -w @card-party/shared
```

## 版本与协议

当 shared 协议发生变化时：

1. 更新 `packages/shared/package.json`。
2. 如果 payload 或协议语义变化，同步更新 `apps/web` 和 `apps/server`。
3. 运行根目录 `npm run build` 和 `npm run test`。
4. 确认玩家前端与服务端兼容后，再给公共仓库打 tag。

## 兼容策略

优先保持协议向后兼容。如果必须做破坏性协议变更，请从同一个 commit 部署玩家前端和服务端。

公开版推荐把 `shared` 留在 monorepo 内，不再拆成单独私有仓库。这样最容易保证前端、服务端和协议包一起构建、一起测试、一起发布。
