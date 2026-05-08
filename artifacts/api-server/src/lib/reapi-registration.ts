import { logger } from "./logger.js";

const DISCOVERY_URL =
  "https://raw.githubusercontent.com/bigmalove/reapi/refs/heads/main/REAPI_DISCOVERY_URL.json";

const REGISTER_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 hours

interface DiscoveryConfig {
  enabled: boolean;
  reapiBaseUrl: string;
  reapiAdminApiKey: string;
}

function getSelfUrl(): string | null {
  const domain = process.env["REPLIT_DEV_DOMAIN"];
  if (domain) {
    return `https://${domain}`;
  }
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const first = domains.split(",")[0].trim();
    if (first) return `https://${first}`;
  }
  return null;
}

async function fetchDiscoveryConfig(): Promise<DiscoveryConfig | null> {
  try {
    const res = await fetch(DISCOVERY_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status },
        "Failed to fetch REAPI_DISCOVERY_URL",
      );
      return null;
    }
    const data = (await res.json()) as DiscoveryConfig;
    return data;
  } catch (err) {
    logger.warn({ err }, "Error fetching REAPI_DISCOVERY_URL");
    return null;
  }
}

async function register(): Promise<void> {
  const config = await fetchDiscoveryConfig();
  if (!config) return;

  if (!config.enabled) {
    logger.info(
      "reapi auto-registration is disabled (enabled=false in discovery config)",
    );
    return;
  }

  const selfUrl = getSelfUrl();
  if (!selfUrl) {
    logger.warn(
      "Cannot determine public URL for reapi-node registration; skipping",
    );
    return;
  }

  const registerUrl = `${config.reapiBaseUrl}/api/upstream-nodes/register`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.reapiAdminApiKey) {
    headers["Authorization"] = `Bearer ${config.reapiAdminApiKey}`;
  }

  try {
    const res = await fetch(registerUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: selfUrl }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      logger.info(
        { selfUrl, reapiBaseUrl: config.reapiBaseUrl },
        "Successfully registered with reapi",
      );
    } else {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: text },
        "reapi registration returned non-OK status",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Error sending registration request to reapi");
  }
}

export function startRcapiRegistration(): void {
  // Initial registration (fire-and-forget, do not block server startup)
  register().catch((err) =>
    logger.warn({ err }, "Unexpected error in reapi registration"),
  );

  // Periodic re-registration every 5 hours
  setInterval(() => {
    register().catch((err) =>
      logger.warn({ err }, "Unexpected error in reapi re-registration"),
    );
  }, REGISTER_INTERVAL_MS).unref(); // unref so this timer won't keep the process alive on its own
}
