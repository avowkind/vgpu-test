export type City = {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
  readonly timeZone: string;
};

export type Place = {
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
  readonly timeZone: string;
  readonly cityId: string | null;
};

export type CivilTime = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
  readonly timeZoneName: string;
  readonly utcOffsetHours: number;
};

const STORAGE_KEY = "vgpu-sundial-place";

export const CITIES: readonly City[] = [
  { id: "auckland", name: "Auckland", country: "New Zealand", lat: -36.8509, lon: 174.7645, timeZone: "Pacific/Auckland" },
  { id: "wellington", name: "Wellington", country: "New Zealand", lat: -41.2866, lon: 174.7756, timeZone: "Pacific/Auckland" },
  { id: "sydney", name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, timeZone: "Australia/Sydney" },
  { id: "melbourne", name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631, timeZone: "Australia/Melbourne" },
  { id: "tokyo", name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, timeZone: "Asia/Tokyo" },
  { id: "singapore", name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, timeZone: "Asia/Singapore" },
  { id: "mumbai", name: "Mumbai", country: "India", lat: 19.076, lon: 72.8777, timeZone: "Asia/Kolkata" },
  { id: "dubai", name: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708, timeZone: "Asia/Dubai" },
  { id: "cairo", name: "Cairo", country: "Egypt", lat: 30.0444, lon: 31.2357, timeZone: "Africa/Cairo" },
  { id: "johannesburg", name: "Johannesburg", country: "South Africa", lat: -26.2041, lon: 28.0473, timeZone: "Africa/Johannesburg" },
  { id: "nairobi", name: "Nairobi", country: "Kenya", lat: -1.2921, lon: 36.8219, timeZone: "Africa/Nairobi" },
  { id: "athens", name: "Athens", country: "Greece", lat: 37.9838, lon: 23.7275, timeZone: "Europe/Athens" },
  { id: "rome", name: "Rome", country: "Italy", lat: 41.9028, lon: 12.4964, timeZone: "Europe/Rome" },
  { id: "paris", name: "Paris", country: "France", lat: 48.8566, lon: 2.3522, timeZone: "Europe/Paris" },
  { id: "london", name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278, timeZone: "Europe/London" },
  { id: "berlin", name: "Berlin", country: "Germany", lat: 52.52, lon: 13.405, timeZone: "Europe/Berlin" },
  { id: "stockholm", name: "Stockholm", country: "Sweden", lat: 59.3293, lon: 18.0686, timeZone: "Europe/Stockholm" },
  { id: "moscow", name: "Moscow", country: "Russia", lat: 55.7558, lon: 37.6173, timeZone: "Europe/Moscow" },
  { id: "reykjavik", name: "Reykjavík", country: "Iceland", lat: 64.1466, lon: -21.9426, timeZone: "Atlantic/Reykjavik" },
  { id: "new-york", name: "New York", country: "USA", lat: 40.7128, lon: -74.006, timeZone: "America/New_York" },
  { id: "chicago", name: "Chicago", country: "USA", lat: 41.8781, lon: -87.6298, timeZone: "America/Chicago" },
  { id: "denver", name: "Denver", country: "USA", lat: 39.7392, lon: -104.9903, timeZone: "America/Denver" },
  { id: "los-angeles", name: "Los Angeles", country: "USA", lat: 34.0522, lon: -118.2437, timeZone: "America/Los_Angeles" },
  { id: "mexico-city", name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332, timeZone: "America/Mexico_City" },
  { id: "sao-paulo", name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, timeZone: "America/Sao_Paulo" },
  { id: "buenos-aires", name: "Buenos Aires", country: "Argentina", lat: -34.6037, lon: -58.3816, timeZone: "America/Argentina/Buenos_Aires" },
  { id: "santiago", name: "Santiago", country: "Chile", lat: -33.4489, lon: -70.6693, timeZone: "America/Santiago" },
  { id: "honolulu", name: "Honolulu", country: "USA", lat: 21.3069, lon: -157.8583, timeZone: "Pacific/Honolulu" },
  { id: "anchorage", name: "Anchorage", country: "USA", lat: 61.2181, lon: -149.9003, timeZone: "America/Anchorage" },
  { id: "vancouver", name: "Vancouver", country: "Canada", lat: 49.2827, lon: -123.1207, timeZone: "America/Vancouver" },
  { id: "toronto", name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, timeZone: "America/Toronto" },
  { id: "lisbon", name: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393, timeZone: "Europe/Lisbon" },
  { id: "madrid", name: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038, timeZone: "Europe/Madrid" },
  { id: "istanbul", name: "Istanbul", country: "Türkiye", lat: 41.0082, lon: 28.9784, timeZone: "Europe/Istanbul" },
  { id: "beijing", name: "Beijing", country: "China", lat: 39.9042, lon: 116.4074, timeZone: "Asia/Shanghai" },
  { id: "hong-kong", name: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694, timeZone: "Asia/Hong_Kong" },
  { id: "seoul", name: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.978, timeZone: "Asia/Seoul" },
  { id: "bangkok", name: "Bangkok", country: "Thailand", lat: 13.7563, lon: 100.5018, timeZone: "Asia/Bangkok" },
  { id: "jakarta", name: "Jakarta", country: "Indonesia", lat: -6.2088, lon: 106.8456, timeZone: "Asia/Jakarta" },
  { id: "perth", name: "Perth", country: "Australia", lat: -31.9505, lon: 115.8605, timeZone: "Australia/Perth" },
  { id: "cape-town", name: "Cape Town", country: "South Africa", lat: -33.9249, lon: 18.4241, timeZone: "Africa/Johannesburg" },
  { id: "rio", name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729, timeZone: "America/Sao_Paulo" },
  { id: "chicago-mid", name: "Houston", country: "USA", lat: 29.7604, lon: -95.3698, timeZone: "America/Chicago" },
  { id: "miami", name: "Miami", country: "USA", lat: 25.7617, lon: -80.1918, timeZone: "America/New_York" },
  { id: "seattle", name: "Seattle", country: "USA", lat: 47.6062, lon: -122.3321, timeZone: "America/Los_Angeles" },
];

export const AUCKLAND = CITIES[0]!;

export function cityToPlace(city: City): Place {
  return {
    label: city.name,
    lat: city.lat,
    lon: city.lon,
    timeZone: city.timeZone,
    cityId: city.id,
  };
}

export function defaultPlace(): Place {
  return cityToPlace(AUCKLAND);
}

export function loadSavedPlace(): Place {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPlace();
    const parsed = JSON.parse(raw) as Partial<Place>;
    if (parsed.cityId) {
      const city = CITIES.find((entry) => entry.id === parsed.cityId);
      if (city) return cityToPlace(city);
    }
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lon === "number" &&
      typeof parsed.timeZone === "string" &&
      typeof parsed.label === "string"
    ) {
      return {
        label: parsed.label,
        lat: parsed.lat,
        lon: parsed.lon,
        timeZone: parsed.timeZone,
        cityId: parsed.cityId ?? null,
      };
    }
  } catch {
    /* ignore */
  }
  return defaultPlace();
}

export function savePlace(place: Place): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    /* ignore */
  }
}

export function matchCities(query: string, limit = 8): City[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...CITIES.slice(0, limit)];
  const scored = CITIES.map((city) => {
    const hay = `${city.name} ${city.country}`.toLowerCase();
    if (hay.startsWith(needle) || city.name.toLowerCase().startsWith(needle)) return { city, score: 0 };
    if (hay.includes(needle)) return { city, score: 1 };
    if (subsequence(hay, needle)) return { city, score: 2 };
    return { city, score: 99 };
  }).filter((row) => row.score < 99);
  scored.sort((a, b) => a.score - b.score || a.city.name.localeCompare(b.city.name));
  return scored.slice(0, limit).map((row) => row.city);
}

export function cityForTimeZone(timeZone: string): City | undefined {
  return CITIES.find((city) => city.timeZone === timeZone);
}

export function nearestCity(lat: number, lon: number): { city: City; km: number } {
  let best = CITIES[0]!;
  let bestKm = haversineKm(lat, lon, best.lat, best.lon);
  for (const city of CITIES) {
    const km = haversineKm(lat, lon, city.lat, city.lon);
    if (km < bestKm) {
      best = city;
      bestKm = km;
    }
  }
  return { city: best, km: bestKm };
}

export function placeFromGeolocation(lat: number, lon: number, timeZone: string): Place {
  const nearest = nearestCity(lat, lon);
  if (nearest.km <= 80) return cityToPlace(nearest.city);
  return {
    label: `${fmtDeg(lat, "NS")}, ${fmtDeg(lon, "EW")}`,
    lat,
    lon,
    timeZone,
    cityId: null,
  };
}

export function civilTime(date: Date, timeZone: string): CivilTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const utc = date.getTime();
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    Number(parts.fractionalSecond ?? "0"),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: Number(parts.fractionalSecond ?? "0"),
    timeZoneName: parts.timeZoneName ?? timeZone,
    utcOffsetHours: (asUtc - utc) / 3_600_000,
  };
}

export function formatClock(hour: number, minute: number, second = 0): string {
  const hh = String(Math.floor(hour)).padStart(2, "0");
  const mm = String(Math.floor(minute)).padStart(2, "0");
  const ss = String(Math.floor(second)).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function subsequence(hay: string, needle: string): boolean {
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i += 1;
    if (i >= needle.length) return true;
  }
  return false;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDeg(value: number, axis: "NS" | "EW"): string {
  const hemi = axis === "NS" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(2)}°${hemi}`;
}
