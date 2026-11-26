import {compare, forecast, createForecastLoader, sharedPickup, decodeChoice} from './engine.mjs?v=2';
import {actions, buildPrompt, modelChoice} from './coach.mjs?v=2';

const loadForecast = createForecastLoader(forecast);
const numberFormat = new Intl.NumberFormat('en-IN');

const byId = id => document.getElementById(id);
const value = id => byId(id).value;
const set = (id, message) => {byId(id).textContent = message;};
const clock = hour => hour.time.slice(11, 16);
const demoHours = [182, 173, 143, 108, 92, 105, 139].map((pm, i) => ({
  pm, time: '2026-11-26T' + String(i + 8).padStart(2, '0') + ':00',
  aqi: [265, 260, 247, 225, 209, 215, 234][i]
}));

for (const action of Object.values(actions)) {
  const line = document.createElement('li');
  line.textContent = action;
  byId('actions').append(line);
}

function render(hours, minutes, fixed) {
  const comparison = compare(hours, hours[0]?.time, minutes);
  if (!comparison) throw new Error('Current data missing');
  const {now, best, index, alternative, reduction} = comparison;
  set('status', (Number.isFinite(now.aqi) ? 'US AQI ' + Math.round(now.aqi) + ' · ' : '') +
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
  timeline.replaceChildren(...hours.map(hour => {
    const wrapper = document.createElement('div');
    wrapper.className = 'bar';
    const bar = document.createElement('div');
    bar.className = 'barFill';
    bar.style.height = (Number.isFinite(hour.pm) ? 54 * hour.pm / max : 0) + 'px';
    bar.setAttribute('aria-hidden','true');
    wrapper.append(Math.round(hour.pm ?? NaN).toString().replace('NaN','—'),bar,clock(hour));
    return wrapper;
  }));
}

async function updatePlan(focus) {
  const sample = byId('demo').checked;
  const city = value('city');
  const minutes = Number(value('minutes'));
  const fixed = value('routine') === 'fixed';
  const button = byId('planner').querySelector('button');
  button.disabled = true;
  set('source', city + ' · ' + (sample ? 'SAMPLE DATA' : 'MODELED FORECAST') + ' · IST');
  set('status', 'Preparing your comparison…');
  byId('results').replaceChildren();
  byId('timeline').replaceChildren();
  try {
    render(sample ? demoHours : await loadForecast(city), minutes, fixed);
  } catch {
    set('status', 'Forecast unavailable. Enable sample data to explore the planner.');
  } finally {
    button.disabled = false;
    if (focus) byId('result-title').focus();
  }
}
byId('planner').addEventListener('submit', event => {event.preventDefault(); void updatePlan(true);});
void updatePlan(false);

byId('coach').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const constraint = value('constraint').trim();
  if (!constraint) {set('suggestion','Enter a household constraint.'); return;}
  button.disabled = true;
  set('suggestion','Checking available AI and matching an action…');
  const prompt = buildPrompt(value('city'), constraint);
  try {
    const raw = await modelChoice(prompt, value('key').trim());
    const id = raw === null ? null : decodeChoice(raw, actions);
    set('suggestion', id ? actions[id] : 'No AI match available. Browse the vetted swaps below.');
  } catch {
    set('suggestion', 'The model is unavailable or still downloading. Browse the vetted swaps below.');
  } finally {button.disabled = false;}
});

byId('pickup').addEventListener('submit', event => {
  event.preventDefault();
  const result = sharedPickup({
    households: Number(value('households')),
    vehicles: Number(value('vehicles')),
    roundTripKm: Number(value('roundTrip'))
  });
  set('pickupResult', result
    ? `${result.baseline} vehicle-km separately, ${result.shared} vehicle-km together. ${result.avoided} vehicle-km avoided for this pickup.`
    : 'Enter a vehicle count no greater than the number of households.');
});
