import test from 'node:test';
import assert from 'node:assert/strict';
import {compare, forecast, decodeChoice, createForecastLoader, sharedPickup} from './engine.mjs';

test('compares equal duration and skips missing values', () => {
  assert.deepEqual(compare([{time:'08:00',pm:180},{time:'09:00',pm:null},{time:'10:00',pm:90}], '08:00', 30),
    {now:{time:'08:00',pm:180},best:{time:'10:00',pm:90},index:5400,alternative:2700,reduction:50});
});
test('withholds comparisons when data or inputs are invalid', () => {
  assert.equal(compare([{time:'08:00',pm:null}], '08:00', 30), null);
  assert.equal(compare([{time:'08:00',pm:60}], '08:00', 61), null);
  assert.equal(compare([{time:'08:00',pm:0},{time:'09:00',pm:1}], '08:00', 30).best, null);
});
test('rejects free-form model output and inherited keys', () => {
  assert.equal(decodeChoice(' shared\n', {shared:true}), 'shared');
  assert.equal(decodeChoice('try shared', {shared:true}), null);
  assert.equal(decodeChoice('__proto__', {shared:true}), null);
});
test('aligns API hours to local current hour', async () => {
  const hours = await forecast('Delhi', async url => {
    assert.equal(url.searchParams.get('timezone'),'Asia/Kolkata');
    return {ok:true,json:async () => ({current:{time:'2026-11-26T09:15'},hourly:{
      time:['2026-11-26T08:00','2026-11-26T09:00'],pm2_5:[100,80],us_aqi:[200,170]}})};
  });
  assert.deepEqual(hours,[{time:'2026-11-26T09:00',pm:80,aqi:170}]);
  await assert.rejects(forecast('Delhi',async () => ({ok:false})));
});

test('shares one fetch across concurrent callers and reloads expired entries', async () => {
  let calls = 0, time = 0;
  const loader = createForecastLoader(async city => ({city, call: ++calls}), () => time);
  const first = loader('Delhi');
  assert.equal(loader('Delhi'), first);
  assert.deepEqual(await first, {city:'Delhi',call:1});
  time = 59_999;
  assert.equal(await loader('Delhi'), await first);
  time = 60_000;
  assert.deepEqual(await loader('Delhi'), {city:'Delhi',call:2});
  assert.deepEqual(await loader('Noida'), {city:'Noida',call:3});
});

test('failed requests can be retried', async () => {
  let calls = 0;
  const loader = createForecastLoader(async () => {
    if (++calls === 1) throw new Error('Offline');
    return [];
  });
  await assert.rejects(loader('Delhi'), /Offline/);
  assert.deepEqual(await loader('Delhi'), []);
});

test('compares vehicle distance and rejects infeasible sharing', () => {
  assert.deepEqual(sharedPickup({households:4,vehicles:2,roundTripKm:8}), {baseline:32,shared:16,avoided:16});
  assert.deepEqual(sharedPickup({households:2,vehicles:2,roundTripKm:8}), {baseline:16,shared:16,avoided:0});
  assert.equal(sharedPickup({households:2,vehicles:3,roundTripKm:8}), null);
});
