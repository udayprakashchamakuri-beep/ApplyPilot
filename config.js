window.APPLYPILOT_API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.endsWith(".vercel.app")
    ? window.location.origin
    : "";
