const { buildPlaceExplainCommand } = require('../../src/scripts/explainPriorityQueries');

describe('Priority explain command', () => {
  it('builds a read-only geo explain without writeConcern', () => {
    const near = { type: 'Point', coordinates: [108.2, 16.05] };
    const command = buildPlaceExplainCommand(near);

    expect(command).toEqual(expect.objectContaining({
      explain: expect.objectContaining({
        aggregate: expect.any(String),
        cursor: {},
      }),
      verbosity: 'executionStats',
    }));
    expect(command.explain.pipeline[0].$geoNear.near).toBe(near);
    expect(command).not.toHaveProperty('writeConcern');
    expect(command.explain).not.toHaveProperty('writeConcern');
  });
});
