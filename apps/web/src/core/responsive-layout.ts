const GAME_BOARD_WIDTH = 1060;
const GAME_BOARD_HEIGHT = 740;

function viewportSize(): { width: number; height: number } {
  const visualViewport = window.visualViewport;
  return {
    width: Math.round(visualViewport?.width || window.innerWidth),
    height: Math.round(visualViewport?.height || window.innerHeight),
  };
}

function updateResponsiveLayout(): void {
  const { width, height } = viewportSize();
  const root = document.documentElement;
  const body = document.body;
  const isSmall = width <= 820 || height <= 520;
  const isPortrait = height > width;
  const gamePadding = isSmall ? 16 : 32;
  const gameScale = Math.min(
    1,
    Math.max(0.22, Math.min(
      (width - gamePadding) / GAME_BOARD_WIDTH,
      (height - gamePadding) / GAME_BOARD_HEIGHT
    ))
  );
  const portraitGameScale = Math.min(
    1,
    Math.max(0.22, Math.min(
      (width - gamePadding) / GAME_BOARD_HEIGHT,
      (height - gamePadding - 118) / GAME_BOARD_WIDTH
    ))
  );

  root.style.setProperty("--uno-vw", `${width}px`);
  root.style.setProperty("--uno-vh", `${height}px`);
  root.style.setProperty("--uno-game-scale", String(gameScale));
  root.style.setProperty("--uno-game-layout-width", `${Math.round(GAME_BOARD_WIDTH * gameScale)}px`);
  root.style.setProperty("--uno-game-layout-height", `${Math.round(GAME_BOARD_HEIGHT * gameScale)}px`);
  root.style.setProperty("--uno-game-portrait-scale", String(portraitGameScale));
  root.style.setProperty("--uno-game-portrait-layout-width", `${Math.round(GAME_BOARD_HEIGHT * portraitGameScale)}px`);
  root.style.setProperty("--uno-game-portrait-layout-height", `${Math.round(GAME_BOARD_WIDTH * portraitGameScale)}px`);

  body.classList.toggle("is-small-screen", isSmall);
  body.classList.toggle("is-portrait", isPortrait);
  body.classList.toggle("is-landscape", !isPortrait);
  body.classList.toggle("is-touch-device", navigator.maxTouchPoints > 0);
}

export function initResponsiveLayout(): void {
  updateResponsiveLayout();
  window.addEventListener("resize", updateResponsiveLayout, { passive: true });
  window.addEventListener("orientationchange", updateResponsiveLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", updateResponsiveLayout, { passive: true });
}
