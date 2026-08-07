const Place = require('../../src/models/Place');

describe('Place geo schema', () => {
  it('synchronizes GeoJSON coordinates from longitude and latitude', async () => {
    const place = new Place({
      name: 'School A',
      type: 'school',
      latitude: 16.05,
      longitude: 108.2,
    });

    await place.validate();
    expect(place.geo.toObject()).toEqual({
      type: 'Point',
      coordinates: [108.2, 16.05],
    });
  });

  it('declares a 2dsphere index for geo queries', () => {
    const indexes = Place.schema.indexes();
    expect(indexes.some(([fields]) => fields.geo === '2dsphere')).toBe(true);
  });
});
