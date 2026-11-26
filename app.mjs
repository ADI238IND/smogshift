import {forecast, createForecastLoader, sharedPickup, decodeChoice} from './engine.mjs?v=3';
import {actions, buildPrompt, modelChoice} from './coach.mjs?v=3';
import {byId, setText, renderComparison} from './view.mjs?v=3';

const loadForecast = createForecastLoader(forecast);

const value = id => byId(id).value;
const demoHours = [182, 173, 143, 108, 92, 105, 139].map((pm, i) => ({
  pm, time: '2026-11-26T' + String(i + 8).padStart(2, '0') + ':00',
  aqi: [265, 260, 247, 225, 209, 215, 234][i]
}));

for (const action of Object.values(actions)) {
  const line = document.createElement('li');
  line.textContent = action;
  byId('actions').append(line);
}

async function updatePlan(focus) {
  const sample = byId('demo').checked;
  const city = value('city');
  const minutes = Number(value('minutes'));
  const fixed = value('routine') === 'fixed';
  const button = byId('planner').querySelector('button');
  button.disabled = true;
  setText('source', city + ' · ' + (sample ? 'SAMPLE DATA' : 'MODELED FORECAST') + ' · IST');
  setText('status', 'Preparing your comparison…');
  byId('results').replaceChildren();
  byId('timeline').replaceChildren();
  try {
    renderComparison(sample ? demoHours : await loadForecast(city), minutes, fixed);
  } catch {
    setText('status', 'Forecast unavailable. Enable sample data to explore the planner.');
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
  if (!constraint) {setText('suggestion','Enter a household constraint.'); return;}
  button.disabled = true;
  setText('suggestion','Checking available AI and matching an action…');
  const prompt = buildPrompt(value('city'), constraint);
  try {
    const raw = await modelChoice(prompt, value('key').trim());
    const id = raw === null ? null : decodeChoice(raw, actions);
    setText('suggestion', id ? actions[id] : 'No AI match available. Browse the vetted swaps below.');
  } catch {
    setText('suggestion', 'The model is unavailable or still downloading. Browse the vetted swaps below.');
  } finally {button.disabled = false;}
});

byId('pickup').addEventListener('submit', event => {
  event.preventDefault();
  const result = sharedPickup({
    households: Number(value('households')),
    vehicles: Number(value('vehicles')),
    roundTripKm: Number(value('roundTrip'))
  });
  setText('pickupResult', result
    ? `${result.baseline} vehicle-km separately, ${result.shared} vehicle-km together. ${result.avoided} vehicle-km avoided for this pickup.`
    : 'Enter a vehicle count no greater than the number of households.');
});
