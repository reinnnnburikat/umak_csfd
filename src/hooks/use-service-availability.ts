import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────
export type ServiceKey =
  | 'GMC'
  | 'UER'
  | 'CDC'
  | 'CAC'
  | 'COMPLAINT'
  | 'DISCIPLINARY';

export type ServiceAvailabilityMap = Record<ServiceKey, boolean>;

interface ServiceToggle {
  serviceKey: string;
  isActive: boolean;
  [key: string]: unknown;
}

// ─── Module-level cache ──────────────────────────────────────────
// Shared across all hook instances so we only fetch once per page load.
let cachedMap: ServiceAvailabilityMap | null = null;
let fetchPromise: Promise<ServiceAvailabilityMap> | null = null;

// All known service keys — used to build a complete map even if the
// API response is missing entries (e.g. DB not yet seeded).
const ALL_KEYS: ServiceKey[] = [
  'GMC',
  'UER',
  'CDC',
  'CAC',
  'COMPLAINT',
  'DISCIPLINARY',
];

function buildDefaultMap(): ServiceAvailabilityMap {
  const map = {} as ServiceAvailabilityMap;
  for (const key of ALL_KEYS) {
    map[key] = true; // Default to available
  }
  return map;
}

async function fetchServiceToggles(): Promise<ServiceAvailabilityMap> {
  // Return cached data immediately if available
  if (cachedMap) return cachedMap;
  // Deduplicate in-flight requests
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch('/api/service-toggles')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json: { data: ServiceToggle[] }) => {
      const map = buildDefaultMap();

      // Merge API data into the map
      if (Array.isArray(json.data)) {
        for (const toggle of json.data) {
          const key = toggle.serviceKey as ServiceKey;
          if (ALL_KEYS.includes(key)) {
            map[key] = toggle.isActive;
          }
        }
      }

      cachedMap = map;
      fetchPromise = null;
      return map;
    })
    .catch(() => {
      // Fail open: all services available
      const fallback = buildDefaultMap();
      cachedMap = fallback;
      fetchPromise = null;
      return fallback;
    });

  return fetchPromise;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useServiceAvailability() {
  const [availability, setAvailability] = useState<ServiceAvailabilityMap>(
    () => cachedMap ?? buildDefaultMap()
  );
  const [loading, setLoading] = useState(() => !cachedMap);

  useEffect(() => {
    // Already cached — initial state is correct
    if (cachedMap) return;

    let cancelled = false;
    fetchServiceToggles().then((data) => {
      if (!cancelled) {
        setAvailability(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const isAvailable = useCallback(
    (key: string): boolean => {
      // Default to true (available) while loading or if key is not recognized
      if (loading) return true;
      return (availability as Record<string, boolean>)[key] ?? true;
    },
    [availability, loading]
  );

  return { availability, loading, isAvailable };
}
