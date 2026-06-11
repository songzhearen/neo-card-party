import "./theme.css";
import "./components/loading-screen";
import { router } from "./core/router";
import { state } from "./core/state";
import { audio } from "./core/audio";
import { api } from "./core/api";
import { initResponsiveLayout } from "./core/responsive-layout";
import { updateHtmlLang } from "./core/i18n";

import { HomeView } from "./views/home";
import { LoginView } from "./views/login";
import { LobbyView } from "./views/lobby";
import { WaitingRoomView } from "./views/waiting-room";
import { GameView } from "./views/game";
import { ProfileView } from "./views/profile";
import { SettingsView } from "./views/settings";
import { ShopView } from "./views/shop";
import { LeaderboardView } from "./views/leaderboard";
import { LootboxView } from "./views/lootbox";
import { GachaView } from "./views/gacha";
import { MusicSynthView } from "./views/music-synth";
import { ResultView } from "./views/result";
import { AvatarGalleryView } from "./views/avatar-gallery";
import { AvatarEditorView } from "./views/avatar-editor";
import { MailView } from "./views/mail";
import { FriendsView } from "./views/friends";

router.register("#home", new HomeView());
router.register("#login", new LoginView());
router.register("#lobby", new LobbyView());
router.register("#waiting", new WaitingRoomView());
router.register("#game", new GameView());
router.register("#profile", new ProfileView());
router.register("#settings", new SettingsView());
router.register("#shop", new ShopView());
router.register("#leaderboard", new LeaderboardView());
router.register("#lootbox", new LootboxView());
router.register("#gacha", new GachaView());
router.register("#music", new MusicSynthView());
router.register("#result", new ResultView());
router.register("#avatars", new AvatarGalleryView());
router.register("#avatar-gallery", new AvatarGalleryView());
router.register("#avatar-editor", new AvatarEditorView());
router.register("#mail", new MailView());
router.register("#friends", new FriendsView());

function init(): void {
  initResponsiveLayout();

  document.addEventListener("click", () => {
    if (!audio.powered) {
      audio.powerOn();
    }
  }, { once: true });

  api.init().then((available) => {
    console.log("[CardParty] Server " + (available ? "connected" : "offline mode"));
  });

  state.onChange((s) => {
    audio.setBgmVolume(s.settings.bgmVolume);
    audio.setSfxVolume(s.settings.sfxVolume);
    updateHtmlLang();
  });

  updateHtmlLang();
  router.start();

  console.log("[CardParty] App initialized");
  console.log("[CardParty] State:", state);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
