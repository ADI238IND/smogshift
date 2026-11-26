# SmogShift

A household decision aid for PromptWars Challenge 6, Urban Air Quality Assistant.

SmogShift compares the same outdoor routine now and later using modeled PM₂.₅.
Its score multiplies outdoor concentration by minutes, holding activity intensity
constant. A fixed commute keeps its start time. The result is a comparative
indicator and cannot estimate inhaled dose, indoor air quality, or street-level exposure.

The household coach uses Gemini Nano through Chrome’s Prompt API, or the Gemini
API when the user provides a key. It selects a vetted action ID from a catalog
covering transport, waiting, cooking, cleaning, and filtration. The application
displays only catalog text, even if model output attempts to change the rules.
No keys or constraints are persisted. Cloud requests send the constraint and
selected city to Google. A static catalog remains available without AI.

The default scenario is clearly labeled sample data and works offline when served
locally. Switch it off for modeled forecasts from [Open-Meteo / CAMS](https://open-meteo.com/en/docs/air-quality-api).
The US AQI scale is labeled explicitly. Household suggestions are informed by
[EPA indoor smoke guidance](https://www.epa.gov/wildfire-smoke-course/strategies-reduce-exposure-indoors).
Local advisories take precedence.

## Run

Serve this directory with `python3 -m http.server 8080` and open
http://localhost:8080. For AI, use compatible desktop Chrome or enter your own
Gemini API key. Start with the default scenario and compare a 30-minute walk
with a fixed school commute.

## Verify

Run `node --test`. Tests cover forecast alignment, missing data,
comparison math, invalid durations and model-output validation.

## How the code fits together

- `engine.mjs` handles forecast loading, time-window comparisons, and shared
  pickup calculations. The forecast loader shares in-flight requests per city,
  caches successful responses for 60 seconds, and allows retries after failures.
- `coach.mjs` holds reviewed household actions and the Gemini adapters.
- `app.mjs` coordinates form input, request state, and domain functions.
- `view.mjs` renders numerical comparisons and chart labels using text nodes. The application has no build step, framework or third-party scripts.

### Shared pickup example

Four households making separate 8 km round trips drive 32 vehicle-km. With two
vehicles and no detours, the same pickups take 16 vehicle-km. The avoided distance
is 16 vehicle-km. SmogShift reports the difference as vehicle distance so families
can compare options without assuming fuel types, emission factors or route data.
