const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const getConfiguredApiBase = (baseUrlOverride?: string) => {
  if (baseUrlOverride) {
    return trimTrailingSlash(baseUrlOverride.trim());
  }

  const viteValue =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_API_BASE_URL
      : undefined;
  const runtimeValue = viteValue || process.env.VITE_API_BASE_URL;
  const value = (runtimeValue || "").trim();
  return value ? trimTrailingSlash(value) : "";
};

export const buildApiUrl = (path: string, baseUrlOverride?: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const configuredBase = getConfiguredApiBase(baseUrlOverride);
  return configuredBase ? `${configuredBase}${normalizedPath}` : normalizedPath;
};

export const resolveAssetUrl = (assetPath?: string | null, baseUrlOverride?: string) => {
  if (!assetPath) return null;
  if (/^https?:\/\//i.test(assetPath) || assetPath.startsWith("data:")) {
    return assetPath;
  }

  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  const configuredBase = getConfiguredApiBase(baseUrlOverride);
  return configuredBase ? `${configuredBase}${normalizedPath}` : normalizedPath;
};

export const getVoiceEngineAvailability = () => {
  const browserSupported =
    typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  return {
    browserSupported,
    serverSupported: false,
    activeMode: "browser" as const,
  };
};
