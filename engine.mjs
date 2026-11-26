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
  return hourly.time.slice(start, start + 7).map((time, offset) => ({
    time, pm: hourly.pm2_5[start + offset], aqi: hourly.us_aqi[start + offset]
  }));
}

export function decodeChoice(raw, choices) {
  const id = raw.trim();
  return Object.hasOwn(choices, id) ? id : null;
}
