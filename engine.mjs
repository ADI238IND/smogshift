export const cities = {
  Ghaziabad: [28.67, 77.45], Noida: [28.54, 77.39], Delhi: [28.61, 77.21],
  Gurugram: [28.46, 77.03], Lucknow: [26.85, 80.95], Patna: [25.59, 85.14]
};

export function compare(hours, current, minutes) {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60) return null;
  const start = hours.findIndex(hour => hour.time === current);
  if (start < 0 || !Number.isFinite(hours[start].pm) || hours[start].pm < 0) return null;
  const options = hours.slice(start + 1, start + 7)
    .filter(hour => Number.isFinite(hour.pm) && hour.pm >= 0 && hour.pm < hours[start].pm);
  const best = options.reduce((lowest, hour) => !lowest || hour.pm < lowest.pm ? hour : lowest, null);
  const now = hours[start];
  return {
    now, best,
    index: Math.round(now.pm * minutes),
    alternative: best ? Math.round(best.pm * minutes) : null,
    reduction: best ? Math.round(100 * (now.pm - best.pm) / now.pm) : null
  };
}

export const FORECAST_TTL_MS = 60_000;

export function createForecastLoader(load, clock = Date.now) {
  const cache = new Map();
  return function loadCity(city) {
    if (!Object.hasOwn(cities, city)) return Promise.reject(new Error('Unsupported city'));
    const previous = cache.get(city);
    if (previous && clock() < previous.expires) return previous.promise;
    const entry = {expires: Infinity};
    entry.promise = Promise.resolve().then(() => load(city)).then(hours => {
      entry.expires = clock() + FORECAST_TTL_MS;
      return hours;
    }).catch(error => {
      cache.delete(city);
      throw error;
    });
    cache.set(city, entry);
    return entry.promise;
  };
}

// Compare otherwise identical round trips. Distance measures vehicle travel,
// not pollution concentration or personal exposure.
export function sharedPickup({households, vehicles, roundTripKm}) {
  if (!Number.isInteger(households) || households < 1 || households > 20 ||
      !Number.isInteger(vehicles) || vehicles < 1 || vehicles > households ||
      !Number.isInteger(roundTripKm) || roundTripKm < 1 || roundTripKm > 100) return null;
  const baseline = households * roundTripKm;
  const shared = vehicles * roundTripKm;
  return {baseline, shared, avoided: baseline - shared};
}

export async function forecast(city, fetcher = fetch) {
  if (!Object.hasOwn(cities, city)) throw new Error('Unsupported city');
  const [latitude, longitude] = cities[city];
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search = new URLSearchParams({latitude, longitude, timezone:'Asia/Kolkata',
    current:'pm2_5,us_aqi', hourly:'pm2_5,us_aqi', forecast_days:2});
  const response = await fetcher(url, {signal: AbortSignal.timeout(9000)});
  if (!response.ok) throw new Error('Forecast unavailable');
  const {hourly, current} = await response.json();
  const currentHour = current.time.slice(0, 13) + ':00';
  const start = hourly.time.indexOf(currentHour);
  if (start < 0) throw new Error('Missing current hour');
  const hours = hourly.time.slice(start, start + 7).map((time, offset) => ({
    time, pm: hourly.pm2_5[start + offset], aqi: hourly.us_aqi[start + offset]
  }));
  if (!Number.isFinite(hours[0].pm) || hours[0].pm < 0) {
    throw new Error('Current PM2.5 is unavailable');
  }
  return hours;
}

export function decodeChoice(raw, choices) {
  const id = raw.trim();
  return Object.hasOwn(choices, id) ? id : null;
}
