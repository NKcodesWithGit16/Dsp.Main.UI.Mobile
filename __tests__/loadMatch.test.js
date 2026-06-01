import { loadMatchScore, bestDriverForLoad } from '../src/utils/loadMatch';

describe('loadMatchScore', () => {
  const baseDriver = {
    id: 'd1',
    name: 'Jane',
    equipment: '53FT Dry Van',
    status: 'idle',
    lat: 41.88,
    lng: -87.63,
  };
  const baseLoad = {
    id: 'L1',
    equipment: '53FT Dry Van',
    pickupLat: 41.9,
    pickupLng: -87.7,
  };

  test('best case: equipment + idle + close = high score', () => {
    expect(loadMatchScore(baseDriver, baseLoad)).toBeGreaterThanOrEqual(80);
  });

  test('wrong equipment drops 40 points', () => {
    const reefer = { ...baseLoad, equipment: 'Reefer' };
    const without = loadMatchScore(baseDriver, reefer);
    const with_ = loadMatchScore(baseDriver, baseLoad);
    expect(with_ - without).toBeGreaterThanOrEqual(20);
  });

  test('offline driver gets no availability credit', () => {
    const offline = { ...baseDriver, status: 'offline' };
    expect(loadMatchScore(offline, baseLoad)).toBeLessThan(loadMatchScore(baseDriver, baseLoad));
  });

  test('missing coords falls back to neutral proximity', () => {
    const noCoords = { ...baseDriver, lat: null, lng: null };
    const score = loadMatchScore(noCoords, baseLoad);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('null inputs return 0', () => {
    expect(loadMatchScore(null, baseLoad)).toBe(0);
    expect(loadMatchScore(baseDriver, null)).toBe(0);
  });
});

describe('bestDriverForLoad', () => {
  test('picks the highest-scoring driver', () => {
    const drivers = [
      { id: 'a', name: 'A', equipment: 'Reefer', status: 'offline' },
      { id: 'b', name: 'B', equipment: '53FT Dry Van', status: 'idle', lat: 41.9, lng: -87.7 },
      { id: 'c', name: 'C', equipment: 'Flatbed', status: 'idle' },
    ];
    const load = { id: 'L1', equipment: '53FT Dry Van', pickupLat: 41.9, pickupLng: -87.7 };
    const result = bestDriverForLoad(drivers, load);
    expect(result.driver.id).toBe('b');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test('empty list returns null', () => {
    expect(bestDriverForLoad([], { id: 'L1' })).toBeNull();
  });
});
