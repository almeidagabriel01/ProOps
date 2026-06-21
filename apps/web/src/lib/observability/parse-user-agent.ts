const UNKNOWN = "Desconhecido";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) return { browser: UNKNOWN, os: UNKNOWN, device: UNKNOWN };

  // Order matters: Edge/Opera masquerade as Chrome; Chrome contains Safari token.
  const browser =
    /Edg\//.test(ua) ? "Edge"
      : /OPR\/|Opera/.test(ua) ? "Opera"
      : /Firefox\//.test(ua) ? "Firefox"
      : /Chrome\//.test(ua) ? "Chrome"
      : /Safari\//.test(ua) ? "Safari"
      : UNKNOWN;

  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
      : /Android/.test(ua) ? "Android"
      : /Windows/.test(ua) ? "Windows"
      : /Mac OS X|Macintosh/.test(ua) ? "macOS"
      : /Linux/.test(ua) ? "Linux"
      : UNKNOWN;

  const device =
    /iPad|Tablet/.test(ua) ? "Tablet"
      : /Mobile|iPhone|Android/.test(ua) ? "Mobile"
      : "Desktop";

  return { browser, os, device };
}
