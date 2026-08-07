const { parsePagination } = require('../../src/utils/pagination');

describe('parsePagination', () => {
  it('uses safe defaults for invalid values', () => {
    expect(parsePagination(
      { page: '-4', limit: 'not-a-number' },
      { defaultLimit: 20, maxLimit: 100 }
    )).toEqual({ pageNum: 1, limitNum: 20, skip: 0 });
  });

  it('caps oversized limits and calculates skip', () => {
    expect(parsePagination(
      { page: '3', limit: '10000' },
      { defaultLimit: 10, maxLimit: 100 }
    )).toEqual({ pageNum: 3, limitNum: 100, skip: 200 });
  });
});
