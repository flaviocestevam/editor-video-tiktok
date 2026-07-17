declare global {
  interface Window {
    __dynamicVisualEffectsFetchInstalled?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__dynamicVisualEffectsFetchInstalled) {
  window.__dynamicVisualEffectsFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body;

    if (url.includes("/api/video/process") && body instanceof FormData) {
      body.set("dynamic_montage_enabled", "true");
      body.set("dynamic_reframe", "true");
      body.set("animated_grain_overlay", "true");
      body.set("scene_color_variation", "true");
      body.set("light_texture_overlay", "true");
    }

    return originalFetch(input, init);
  };
}

export {};
