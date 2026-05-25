const LOCAL_API_BASE = "http://localhost:4000";
const PRODUCTION_API_BASE = "https://pie.blindlounge.xyz";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function resolveApiBase(): string {
  const configuredBase =
    import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL;

  const fallbackBase = import.meta.env.PROD
    ? PRODUCTION_API_BASE
    : LOCAL_API_BASE;

  const base = configuredBase?.trim() || fallbackBase;
  console.log(`API BASE : ${base}`);

  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return "";
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    base.startsWith("http:")
  ) {
    return "";
  }

  return normalizeBaseUrl(base);
}

export const API_BASE = resolveApiBase();
