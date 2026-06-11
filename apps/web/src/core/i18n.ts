/**
 * 国际化 (i18n) 模块
 * 支持中文/英文切换，基于 state.settings.language 响应式
 */

import { state } from "./state";

type LocaleMap = Record<string, string>;

const zh: LocaleMap = {
  // 导航栏
  "nav.home": "首页",
  "nav.lobby": "大厅",
  "nav.game": "游戏",
  "nav.shop": "商城",
  "nav.profile": "个人",
  "nav.settings": "设置",

  // 首页
  "home.subtitle": "轻快现代像素",
  "home.startGame": "开始游戏",
  "home.lobby": "房间大厅",
  "home.profile": "个人界面",

  // 登录
  "login.title": "玩家登录",
  "login.playerId": "账号",
  "login.secretCode": "密码",
  "login.startGame": "进入游戏",
  "login.createId": "注册账号",
  "login.loginTab": "登录",
  "login.registerTab": "注册",
  "login.submit": "登录",
  "login.registerSubmit": "创建账号",
  "login.connecting": "连接中...",
  "login.connected": "已连接 \u2713",
  "login.registered": "注册成功 \u2713",
  "login.failed": "登录失败，请重试",
  "login.usernameRequired": "请输入账号",
  "login.passwordRequired": "请输入密码",
  "login.back": "\u2190 返回首页",

  // 大厅
  "lobby.title": "房间大厅",
  "lobby.back": "\u2190 返回",
  "lobby.onlineRooms": "在线房间",
  "lobby.refresh": "刷新 \u21BA",
  "lobby.loading": "加载中...",
  "lobby.createRoom": "创建房间",
  "lobby.quickJoin": "快速加入",
  "lobby.joining": "加入中...",
  "lobby.loadFailed": "加载失败",
  "lobby.join": "加入",
  "lobby.full": "满员",
  "lobby.noRooms": "暂无可用房间，点击下方按钮创建一间吧！",
  "lobby.ante": "底注",

  // 个人
  "profile.title": "个人资料",
  "profile.back": "\u2190 返回",
  "profile.edit": "编辑",
  "profile.editAvatar": "\uD83C\uDFA8 编辑头像",
  "profile.nickname": "昵称",
  "profile.save": "保存资料",
  "profile.logout": "退出登录",
  "profile.loginPromptTitle": "登录后查看个人资料",
  "profile.loginPromptDesc": "登录账号后，可以同步昵称、头像、称号、战绩、金币和邮件奖励。",
  "profile.loginAction": "去登录",
  "profile.totalGames": "总场次",
  "profile.wins": "胜场",
  "profile.level": "等级",
  "profile.coins": "金币",
  "profile.points": "积分",
  "profile.titleLabel": "称号",
  "profile.accessories": "饰品",
  "profile.titles": "称号库",
  "profile.titleRule": "等级 / 排位",
  "profile.recentMatches": "最近对局",
  "profile.historyEmpty": "暂无对局记录",
  "profile.historyWin": "胜利",
  "profile.historyLose": "失败",
  "profile.historyAi": "AI",
  "profile.historyOnline": "联机",

  // 设置
  "settings.title": "\u2699\uFE0F 设置",
  "settings.audio": "\uD83C\uDFB5 音频",
  "settings.bgmVolume": "BGM 音量",
  "settings.sfxVolume": "SFX 音量",
  "settings.languageSection": "\uD83C\uDF10 语言",
  "settings.uiLang": "界面语言",
  "settings.network": "\uD83D\uDCE1 网络",
  "settings.ping": "延迟",
  "settings.save": "\uD83D\uDCBE 保存",
  "settings.reset": "\uD83D\uDD04 重置",

  // 商城
  "shop.store": "商城",
  "shop.inventory": "背包",
  "shop.redeem": "兑换",
  "shop.redeemPlaceholder": "输入兑换码",
  "shop.shopTab": "商城",
  "shop.inventoryTab": "背包",
  "shop.backToLobby": "\uD83C\uDFE0 返回大厅",
  "shop.loading": "加载中...",
  "shop.loadFailed": "加载失败",
  "shop.buySuccess": "购买成功！",
  "shop.noCoins": "金币不足！",
  "shop.invalidCode": "兑换码无效",
  "shop.redeemSuccess": "兑换成功",
  "shop.redeemLoginRequired": "请先登录账号再兑换",
  "shop.redeemCodeRequired": "请输入兑换码",
  "shop.redeemDisabled": "兑换码已停用",
  "shop.redeemExpired": "兑换码已过期",
  "shop.redeemExhausted": "兑换码已被领完",
  "shop.redeemAlreadyUsed": "这个兑换码已经使用过",
  "shop.owned": "已购买",
  "shop.consumable": "可使用 (局内)",
  "shop.equipped": "正在使用",
  "shop.equip": "点击装备",
  "shop.openBox": "开箱 160",
  "shop.accessory": "饰品",

  // 排行榜
  "leaderboard.title": "排行榜",
  "leaderboard.global": "全球",
  "leaderboard.backToLobby": "\uD83C\uDFE0 返回大厅",
  "leaderboard.loading": "加载中...",
  "leaderboard.loadFailed": "加载失败",
  "leaderboard.empty": "\u6682\u65e0\u6392\u884c\u6570\u636e",
  "leaderboard.winRate": "胜率",

  // 游戏
  "game.title": "卡牌对战模式",
  "game.deck": "牌堆",
  "game.discard": "弃牌",
  "game.cardsCount": "{0} 张",
  "game.setup": "\u2699\uFE0F 游戏设置",
  "game.playerCount": "玩家人数: 2 ~ 12 (含你自己)",
  "game.startGame": "\uD83C\uDFAE 开始游戏",
  "game.youWin": "\uD83C\uDFC6 你赢了！",
  "game.otherWin": "\uD83D\uDC80 {0} 赢了！",
  "game.playAgain": "\uD83D\uDD04 再来一局",
  "game.cantPlay": "不能出这张牌！",
  "game.deckEmpty": "牌堆空了！",
  "game.unoShout": "LAST! \uD83D\uDCE2",
  "game.drawThenPlay": "摸牌后只能出刚摸的牌或跳过",
  "game.caughtUno": "\uD83D\uDC40 {0} 忘了喊 LAST！罚摸 2 张！",
  "game.playerCards": "{0}牌",
  "game.me": "我",
  "game.cpu": "电脑",
  "game.draw": "[+] 摸牌",
  "game.pass": "\u23ED 跳过",
  "game.unoBtn": "LAST!",
  "game.reset": "\u21BA 重开",
  "game.shout": "\uD83D\uDCAC 互动",
  "game.mobilePortraitTitle": "建议横屏游玩",
  "game.mobilePortraitBody": "移动端游戏桌会按屏幕自动缩放，横屏后可读性和点击手感更好。",

  // 喊话/互动 (中文)
  "shout.battle": "\u2694\uFE0F 战斗爽！",
  "shout.hurry": "\u23F3 快点阿！",
  "shout.zaWarudo": "\u23F1\uFE0F 砸瓦鲁多！",
  "shout.calculate": "\uD83E\uDDE0 你的计算？！",
  "shout.bugCards": "\uD83D\uDC1B 烂牌如漏洞",
  "interact.tomato": "\uD83C\uDF45 扔番茄",
  "interact.coffee": "\u2615 请咖啡",
  "interact.poop": "\uD83D\uDCA9 扔粑粑",

  // 开箱
  "lootbox.title": "宝箱",
  "lootbox.subtitle": "160 金币 / 次，粉色饰品仅此产出",
  "lootbox.openAgain": "\uD83C\uDF81 再开一次",
  "lootbox.openTen": "\uD83C\uDFB0 十连 1600",
  "lootbox.back": "\uD83C\uDFE0 返回",

  // 十连抽
  "gacha.title": "十连开箱",
  "gacha.badge": "十连抽",
  "gacha.again": "\uD83C\uDFB0 再来十连",
  "gacha.back": "\uD83C\uDFE0 返回",

  // 音乐合成器
  "synth.title": "8位音频台",
  "synth.powerOff": "未开启",
  "synth.powerOn": "已开启",
  "synth.sfxPanel": "\uD83C\uDFB5 音效面板",
  "synth.melodyPanel": "\uD83C\uDFBC 迷你旋律",
  "synth.back": "\uD83C\uDFE0 返回",
  "synth.sfx.play": "出牌",
  "synth.sfx.draw": "抽牌",
  "synth.sfx.uno": "LAST!",
  "synth.sfx.open": "开箱",
  "synth.sfx.click": "点击",
  "synth.sfx.success": "成功",
  "synth.sfx.fail": "失败",
  "synth.sfx.hint": "提示",
  "synth.melody.win": "胜利",
  "synth.melody.lose": "失败",
  "synth.melody.scale": "音阶",
  "synth.melody.star": "小星星",

  // 结算
  "result.victory": "\uD83C\uDFC6 胜利",
  "result.defeat": "\uD83D\uDC80 失败",
  "result.mvp": "最佳",
  "result.pts": "分",
  "result.scoreboard": "计分板",
  "result.remainingCards": "剩余 {0} 张牌",
  "result.playAgain": "\uD83D\uDD04 再来一局",
  "result.backHome": "\uD83C\uDFE0 返回首页",
  "result.noResult": "暂无对局数据，请先完成一局游戏",
  "result.playedCards": "出牌 {0} 张",
  "result.handValue": "手牌分 {0}",
  "result.rankBonus": "排名 +{0}",
  "result.playBonus": "出牌 +{0}",
  "result.residueBonus": "收分 +{0}",
  "result.cardPenalty": "剩牌 -{0}",
  "result.rankLabel": "#{0}",
  "result.formula": "排名 + 出牌 - 剩牌",

  // 头像编辑器
  "avatarEditor.title": "头像编码",
  "avatarEditor.subtitle": "RGB 序列化数据 (384位)",
  "avatarEditor.placeholder": "这里将实时生成代表头像的字符串...",
  "avatarEditor.brush": "\uD83D\uDD8C\uFE0F 画笔",
  "avatarEditor.eraser": "\uD83E\uDDFD 橡皮",
  "avatarEditor.clear": "\uD83D\uDDD1\uFE0F 清空",
  "avatarEditor.import": "\uD83D\uDCE5 导入",
  "avatarEditor.copy": "\uD83D\uDCCB 复制",
  "avatarEditor.save": "\uD83D\uDCBE 保存为头像",
  "avatarEditor.back": "\u2190 返回",

  // 头像图鉴
  "avatarGallery.title": "头像图鉴",
  "avatarGallery.reroll": "重新生成 \u21BA",
  "avatarGallery.draw": "\uD83D\uDD8C\uFE0F 手绘头像",
  "avatarGallery.choose": "选择头像",
  "avatarGallery.back": "\u2190 返回",

  // 加载界面
  "loading.title": "思考中",
  "loading.initSystem": "> 初始化系统...",
  "loading.done": "> 思考完毕，即将进入游戏！",
  "loading.joke1": "> 正在更换服务器里烤焦的土豆...",
  "loading.joke2": "> 正在往跑轮里投放新鲜的仓鼠...",
  "loading.joke3": "> 正在向发量献祭以求代码无BUG...",
  "loading.joke4": "> 把 Loading 换成 Thinking 显得更高级...",
  "loading.joke5": "> 正在说服代码不要崩溃...",
  "loading.joke6": "> 试图在几万行代码里寻找那个缺失的分号...",
  "loading.joke7": "> 正在给网络线做心肺复苏...",
  "loading.joke8": "> 程序员正在喝第5杯咖啡...",
  "loading.joke9": "> 正在向赛博佛祖祈祷...",
  "loading.joke10": "> 正在渲染每一个完美的像素块...",

  // 等待房间
  "waiting.title": "等待房间",
  "waiting.leave": "\u2190 退出",
  "waiting.aiMode": "人机对战",
  "waiting.multiMode": "多人联机",
  "waiting.roomBadge": "房间 ({0}/{1})",
  "waiting.chatRoom": "房间聊天 ({0}/{1})",
  "waiting.chatPlaceholder": "输入文字...",
  "waiting.clickReady": "点击准备",
  "waiting.readyDone": "已准备 \u2713",
  "waiting.startGame": "\uD83C\uDFAE 开始游戏",
  "waiting.ready": "已准备",
  "waiting.notReady": "未准备",
  "waiting.waitingPlayer": "等待中...",
  "waiting.roomCreated": "房间已创建",
  "waiting.aiCount": "人机数量",
  "waiting.aiHint": "房主一人即可开始",
  "waiting.capacity": "总容量",
  "waiting.multiHint": "全员准备后可开始",
  "waiting.copyInvite": "复制邀请",
  "waiting.inviteFriends": "邀请好友",
  "waiting.inviteCopied": "房间邀请链接已复制",
  "waiting.cantReduce": "\u26A0\uFE0F 有玩家在线，无法减少容量",
  "waiting.capacityChanged": "\u2194 房间容量变更为 {0} 人",
  "waiting.kicked": "被踢出",
  "waiting.left": "离开了房间",
  "waiting.readyAnnounce": "准备就绪",
  "waiting.cancelReady": "取消了准备",
  "waiting.readyStatus": "已准备",
  "waiting.aiJoined": "人机 {0} 加入了房间",

  // 通用
  "common.close": "\u2715",
  "common.back": "\u2190 返回",
};

const en: LocaleMap = {
  // Navigation
  "nav.home": "Home",
  "nav.lobby": "Lobby",
  "nav.game": "Game",
  "nav.shop": "Shop",
  "nav.profile": "Profile",
  "nav.settings": "Settings",

  // Home
  "home.subtitle": "LIGHT MODERN PIXEL",
  "home.startGame": "Start Game",
  "home.lobby": "Room Lobby",
  "home.profile": "Profile",

  // Login
  "login.title": "PLAYER LOGIN",
  "login.playerId": "ACCOUNT",
  "login.secretCode": "SECRET CODE",
  "login.startGame": "START GAME \u25B6",
  "login.createId": "CREATE ID",
  "login.loginTab": "Log In",
  "login.registerTab": "Register",
  "login.submit": "Log In",
  "login.registerSubmit": "Create Account",
  "login.connecting": "CONNECTING...",
  "login.connected": "CONNECTED! \u2713",
  "login.registered": "REGISTERED! \u2713",
  "login.failed": "Login failed. Please try again.",
  "login.usernameRequired": "Please enter an account.",
  "login.passwordRequired": "Please enter a password.",
  "login.back": "\u2190 Back to Home",

  // Lobby
  "lobby.title": "LOBBY",
  "lobby.back": "\u2190 Back",
  "lobby.onlineRooms": "Online Rooms",
  "lobby.refresh": "Refresh \u21BA",
  "lobby.loading": "Loading...",
  "lobby.createRoom": "Create Room",
  "lobby.quickJoin": "Quick Join",
  "lobby.joining": "Joining...",
  "lobby.loadFailed": "Load Failed",
  "lobby.join": "Join",
  "lobby.full": "Full",
  "lobby.noRooms": "No rooms available. Create one below!",
  "lobby.ante": "Ante",

  // Profile
  "profile.title": "PROFILE",
  "profile.back": "\u2190 Back",
  "profile.edit": "Edit",
  "profile.editAvatar": "\uD83C\uDFA8 Edit Avatar",
  "profile.nickname": "NICKNAME",
  "profile.save": "Save Profile",
  "profile.logout": "Log Out",
  "profile.loginPromptTitle": "Log in to view your profile",
  "profile.loginPromptDesc": "Log in to sync your nickname, avatar, title, match history, coins, and mail rewards.",
  "profile.loginAction": "Log In",
  "profile.totalGames": "Total Games",
  "profile.wins": "Wins",
  "profile.level": "Level",
  "profile.coins": "Coins",
  "profile.points": "Points",
  "profile.titleLabel": "Title",
  "profile.accessories": "Accessories",
  "profile.titles": "Titles",
  "profile.titleRule": "Level / Rank",
  "profile.recentMatches": "Recent Matches",
  "profile.historyEmpty": "No matches yet",
  "profile.historyWin": "Win",
  "profile.historyLose": "Loss",
  "profile.historyAi": "AI",
  "profile.historyOnline": "Online",

  // Settings
  "settings.title": "\u2699\uFE0F Settings",
  "settings.audio": "\uD83C\uDFB5 Audio",
  "settings.bgmVolume": "BGM Volume",
  "settings.sfxVolume": "SFX Volume",
  "settings.languageSection": "\uD83C\uDF10 Language",
  "settings.uiLang": "UI Language",
  "settings.network": "\uD83D\uDCE1 Network",
  "settings.ping": "PING",
  "settings.save": "\uD83D\uDCBE Save",
  "settings.reset": "\uD83D\uDD04 Reset",

  // Shop
  "shop.store": "STORE",
  "shop.inventory": "INVENTORY",
  "shop.redeem": "Redeem",
  "shop.redeemPlaceholder": "ENTER CODE...",
  "shop.shopTab": "Shop",
  "shop.inventoryTab": "Inventory",
  "shop.backToLobby": "\uD83C\uDFE0 Back to Lobby",
  "shop.loading": "Loading...",
  "shop.loadFailed": "Load Failed",
  "shop.buySuccess": "Purchase Successful!",
  "shop.noCoins": "Not Enough Coins!",
  "shop.invalidCode": "Invalid code",
  "shop.redeemSuccess": "Redeemed successfully",
  "shop.redeemLoginRequired": "Please log in before redeeming.",
  "shop.redeemCodeRequired": "Please enter a redeem code.",
  "shop.redeemDisabled": "This code is disabled.",
  "shop.redeemExpired": "This code has expired.",
  "shop.redeemExhausted": "This code has been fully claimed.",
  "shop.redeemAlreadyUsed": "You have already redeemed this code.",
  "shop.owned": "Owned",
  "shop.consumable": "Usable (In-game)",
  "shop.equipped": "Equipped",
  "shop.equip": "Equip",
  "shop.openBox": "Box 160",
  "shop.accessory": "Accessory",

  // Leaderboard
  "leaderboard.title": "Leaderboard",
  "leaderboard.global": "Global",
  "leaderboard.backToLobby": "\uD83C\uDFE0 Back to Lobby",
  "leaderboard.loading": "Loading...",
  "leaderboard.loadFailed": "Load Failed",
  "leaderboard.empty": "No ranking data yet",
  "leaderboard.winRate": "Win Rate",

  // Game
  "game.title": "CARD PARTY - BATTLE MODE",
  "game.deck": "DECK",
  "game.discard": "DISCARD",
  "game.cardsCount": "{0} cards",
  "game.setup": "\u2699\uFE0F Game Setup",
  "game.playerCount": "Players: 2 ~ 12 (including you)",
  "game.startGame": "\uD83C\uDFAE Start Game",
  "game.youWin": "\uD83C\uDFC6 You Win!",
  "game.otherWin": "\uD83D\uDC80 {0} Won!",
  "game.playAgain": "\uD83D\uDD04 Play Again",
  "game.cantPlay": "Can't play this card!",
  "game.deckEmpty": "Deck is empty!",
  "game.unoShout": "LAST! \uD83D\uDCE2",
  "game.drawThenPlay": "After drawing, play that card or pass",
  "game.caughtUno": "\uD83D\uDC40 {0} forgot to call LAST! Draw 2!",
  "game.playerCards": "{0} cards",
  "game.me": "Me",
  "game.cpu": "CPU",
  "game.draw": "[+] DRAW",
  "game.pass": "\u23ED PASS",
  "game.unoBtn": "LAST!",
  "game.reset": "\u21BA RESET",
  "game.shout": "\uD83D\uDCAC SHOUT",
  "game.mobilePortraitTitle": "Landscape Recommended",
  "game.mobilePortraitBody": "The mobile game board scales to the screen. Rotate your phone for better readability and touch control.",

  // Shouts/Interactions
  "shout.battle": "\u2694\uFE0F Fight!",
  "shout.hurry": "\u23F3 Hurry Up!",
  "shout.zaWarudo": "\u23F1\uFE0F Za Warudo!",
  "shout.calculate": "\uD83E\uDDE0 Calculated?!",
  "shout.bugCards": "\uD83D\uDC1B Buggy Cards!",
  "interact.tomato": "\uD83C\uDF45 Tomato",
  "interact.coffee": "\u2615 Coffee",
  "interact.poop": "\uD83D\uDCA9 Poop",

  // Lootbox
  "lootbox.title": "LOOT BOX",
  "lootbox.subtitle": "160 coins each. Pink accessories are box-only.",
  "lootbox.openAgain": "\uD83C\uDF81 Open Again",
  "lootbox.openTen": "\uD83C\uDFB0 10x 1600",
  "lootbox.back": "\uD83C\uDFE0 Back",

  // Gacha
  "gacha.title": "10x GACHA",
  "gacha.badge": "10x Pull",
  "gacha.again": "\uD83C\uDFB0 Another 10x",
  "gacha.back": "\uD83C\uDFE0 Back",

  // Music Synth
  "synth.title": "8-BIT SYNTH",
  "synth.powerOff": "POWER OFF",
  "synth.powerOn": "POWER ON",
  "synth.sfxPanel": "\uD83C\uDFB5 SFX Panel",
  "synth.melodyPanel": "\uD83C\uDFBC Mini Melodies",
  "synth.back": "\uD83C\uDFE0 Back",
  "synth.sfx.play": "Play Card",
  "synth.sfx.draw": "Draw Card",
  "synth.sfx.uno": "LAST!",
  "synth.sfx.open": "Open Box",
  "synth.sfx.click": "Click",
  "synth.sfx.success": "Success",
  "synth.sfx.fail": "Fail",
  "synth.sfx.hint": "Hint",
  "synth.melody.win": "Victory",
  "synth.melody.lose": "Defeat",
  "synth.melody.scale": "Scale",
  "synth.melody.star": "Twinkle",

  // Result
  "result.victory": "\uD83C\uDFC6 VICTORY",
  "result.defeat": "\uD83D\uDC80 DEFEAT",
  "result.mvp": "MVP",
  "result.pts": "pts",
  "result.scoreboard": "SCOREBOARD",
  "result.remainingCards": "{0} cards left",
  "result.playAgain": "\uD83D\uDD04 Play Again",
  "result.backHome": "\uD83C\uDFE0 Back to Home",
  "result.noResult": "No game data yet. Finish a game first!",
  "result.playedCards": "{0} played",
  "result.handValue": "hand value {0}",
  "result.rankBonus": "rank +{0}",
  "result.playBonus": "played +{0}",
  "result.residueBonus": "pool +{0}",
  "result.cardPenalty": "left -{0}",
  "result.rankLabel": "#{0}",
  "result.formula": "rank + played - leftovers",

  // Avatar Editor
  "avatarEditor.title": "Avatar Code",
  "avatarEditor.subtitle": "RGB Serialized Data (384 bits)",
  "avatarEditor.placeholder": "The avatar string will be generated here in real time...",
  "avatarEditor.brush": "\uD83D\uDD8C\uFE0F Brush",
  "avatarEditor.eraser": "\uD83E\uDDFD Eraser",
  "avatarEditor.clear": "\uD83D\uDDD1\uFE0F Clear",
  "avatarEditor.import": "\uD83D\uDCE5 Import",
  "avatarEditor.copy": "\uD83D\uDCCB Copy",
  "avatarEditor.save": "\uD83D\uDCBE Save as Avatar",
  "avatarEditor.back": "\u2190 Back",

  // Avatar Gallery
  "avatarGallery.title": "AVATARS",
  "avatarGallery.reroll": "Regenerate \u21BA",
  "avatarGallery.draw": "\uD83D\uDD8C\uFE0F Draw",
  "avatarGallery.choose": "Choose avatar",
  "avatarGallery.back": "\u2190 Back",

  // Loading Screen
  "loading.title": "THINKING",
  "loading.initSystem": "> Initializing system...",
  "loading.done": "> Thinking done, entering game!",
  "loading.joke1": "> Replacing burnt potatoes in the server...",
  "loading.joke2": "> Deploying fresh hamsters to the wheels...",
  "loading.joke3": "> Sacrificing hair for bug-free code...",
  "loading.joke4": "> Changing Loading to Thinking for extra class...",
  "loading.joke5": "> Convincing the code not to crash...",
  "loading.joke6": "> Searching for that missing semicolon in thousands of lines...",
  "loading.joke7": "> Performing CPR on the network cable...",
  "loading.joke8": "> The programmer is on their 5th cup of coffee...",
  "loading.joke9": "> Praying to the Cyber Buddha...",
  "loading.joke10": "> Rendering every perfect pixel block...",

  // Waiting Room
  "waiting.title": "Waiting Room",
  "waiting.leave": "\u2190 Leave",
  "waiting.aiMode": "AI Battle",
  "waiting.multiMode": "Multiplayer",
  "waiting.roomBadge": "ROOM ({0}/{1})",
  "waiting.chatRoom": "Room Chat ({0}/{1})",
  "waiting.chatPlaceholder": "Type a message...",
  "waiting.clickReady": "Click to Ready",
  "waiting.readyDone": "Ready \u2713",
  "waiting.startGame": "\uD83C\uDFAE Start Game",
  "waiting.ready": "READY",
  "waiting.notReady": "NOT READY",
  "waiting.waitingPlayer": "WAITING...",
  "waiting.roomCreated": "Room Created",
  "waiting.aiCount": "AI Count",
  "waiting.aiHint": "Host can start alone",
  "waiting.capacity": "Capacity",
  "waiting.multiHint": "All ready to start",
  "waiting.copyInvite": "Copy Invite",
  "waiting.inviteFriends": "Invite Friends",
  "waiting.inviteCopied": "Room invite link copied",
  "waiting.cantReduce": "\u26A0\uFE0F Players online, cannot reduce",
  "waiting.capacityChanged": "\u2194 Room capacity changed to {0}",
  "waiting.kicked": "was kicked",
  "waiting.left": "left the room",
  "waiting.readyAnnounce": "is ready",
  "waiting.cancelReady": "canceled ready",
  "waiting.readyStatus": "ready",
  "waiting.aiJoined": "CPU {0} joined the room",

  // Common
  "common.close": "\u2715",
  "common.back": "\u2190 Back",
};

const locales: Record<string, LocaleMap> = { zh, en };

/**
 * 获取翻译文本
 * @param key 翻译键，如 "nav.home"
 * @param params 插值参数，如 { 0: "5" }
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const locale = locales[state.settings.language] ?? locales.zh;
  let text = locale[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * 响应语言切换变化
 * @param fn 当语言变化时调用的回调
 * @returns 取消订阅函数
 */
export function onLangChange(fn: () => void): () => void {
  let prevLang = state.settings.language;
  return state.onChange((s) => {
    if (s.settings.language !== prevLang) {
      prevLang = s.settings.language;
      fn();
    }
  });
}

/**
 * 更新 HTML lang 属性
 */
export function updateHtmlLang(): void {
  document.documentElement.lang = state.settings.language === "zh" ? "zh-CN" : "en";
}
