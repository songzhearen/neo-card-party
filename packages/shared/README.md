# @card-party/shared

`@card-party/shared` 是玩家前端和服务端共用的 TypeScript 协议包。它应该保持小而纯粹，只放公共类型、房间 payload、协议版本和无副作用规则辅助函数。

## 职责边界

- UI 代码留在 `apps/web`。
- Colyseus Room、数据库、运行时逻辑留在 `apps/server`。这里的 Colyseus 指第三方实时多人游戏框架。
- 管理后台界面留在 `apps/admin`。
- 前后端都需要理解的协议和纯规则放在 `packages/shared`。

## 本地依赖

公共 monorepo 中，web 和 server 通过本地路径引用 shared：

```json
"@card-party/shared": "file:../../packages/shared"
```

## 修改建议

修改 shared 协议时，请同步检查 web 和 server：

- 如果新增动作类型，前端发送逻辑和服务端处理逻辑都要更新。
- 如果修改房间 payload，前端渲染和服务端广播都要更新。
- 如果修改协议版本，服务端 `/api/health` 和前端兼容逻辑也要确认。

修改后建议在仓库根目录运行：

```powershell
npm run build
npm run test
```

更多发布流程见 `RELEASE.md`。
