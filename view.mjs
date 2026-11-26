import {compare} from './engine.mjs?v=3';

const numberFormat = new Intl.NumberFormat('en-IN');
const clock = hour => hour.time.slice(11, 16);

export const byId = id => document.getElementById(id);
export const setText = (id, message) => { byId(id).textContent = message; };

export function renderComparison(hours, minutes, fixed) {
  const comparison = compare(hours, hours[0]?.time, minutes);
  if (!comparison) throw new Error('Current data missing');
  const {now, best, index, alternative, reduction} = comparison;
  setText('status', (Number.isFinite(now.aqi) ? 'US AQI ' + Math.round(now.aqi) + ' · ' : '') +
    'PM₂.₅ ' + now.pm.toFixed(1) + ' µg/m³ at ' + clock(now));
  const next = fixed
    ? 'Keep your departure time. Shorten time outdoors while waiting if practical, or compare a shared ride in the coach.'
    : best
      ? 'The lowest modeled PM₂.₅ in the next six hours is at ' + clock(best) +
        '. For the same duration, the comparison score is ' + reduction + '% lower. Check local advisories before heading out.'
      : 'No lower PM₂.₅ hour is available in this forecast window. Consider an indoor alternative if the activity is flexible.';
  const results = byId('results');
  results.replaceChildren();
  const metrics = document.createElement('div');
  metrics.className = 'metrics';
  const values = [['Usual time', index], ...(best && !fixed ? [['Later option', alternative]] : [])];
  for (const [label, score] of values) {
    const tile = document.createElement('div');
    tile.className = 'metric';
    const number = document.createElement('strong');
    number.textContent = numberFormat.format(score);
    tile.append(number, label);
    metrics.append(tile);
  }
  const note = document.createElement('p');
  note.className = 'explain';
  note.textContent = next + ' Score = outdoor PM₂.₅ × minutes (µg·min/m³). It compares scenarios at equal activity intensity. Personal dose and indoor exposure are unmeasured.';
  results.append(metrics,note);
  const timeline = byId('timeline');
  timeline.className = 'bars';
  const max = Math.max(1, ...hours.map(hour => hour.pm ?? 0));
  timeline.setAttribute('aria-label', 'Hourly modeled PM2.5 in micrograms per cubic metre');
  timeline.replaceChildren(...hours.map(hour => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bar';
    wrapper.setAttribute('role', 'listitem');
    const bar = document.createElement('div');
    bar.className = 'barFill';
    bar.style.height = (Number.isFinite(hour.pm) ? 54 * hour.pm / max : 0) + 'px';
    bar.setAttribute('aria-hidden','true');
    wrapper.append(Number.isFinite(hour.pm) ? String(Math.round(hour.pm)) : '—', bar, clock(hour));
    return wrapper;
  }));
}

