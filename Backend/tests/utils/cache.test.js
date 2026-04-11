const SimpleCache = require('../../src/utils/cache');

describe('SimpleCache', () => {
  beforeEach(() => {
    SimpleCache.clear();
  });

  describe('set() and get()', () => {
    it('should store and retrieve a value', () => {
      SimpleCache.set('key1', { data: 'hello' });

      expect(SimpleCache.get('key1')).toEqual({ data: 'hello' });
    });

    it('should return null for non-existent key', () => {
      expect(SimpleCache.get('nonexistent')).toBeNull();
    });

    it('should store different data types', () => {
      SimpleCache.set('string', 'hello');
      SimpleCache.set('number', 42);
      SimpleCache.set('array', [1, 2, 3]);
      SimpleCache.set('object', { a: 1 });

      expect(SimpleCache.get('string')).toBe('hello');
      expect(SimpleCache.get('number')).toBe(42);
      expect(SimpleCache.get('array')).toEqual([1, 2, 3]);
      expect(SimpleCache.get('object')).toEqual({ a: 1 });
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entries', () => {
      jest.useFakeTimers();

      SimpleCache.set('expiring', 'data', 1000); // 1 second TTL
      expect(SimpleCache.get('expiring')).toBe('data');

      jest.advanceTimersByTime(1500); // advance 1.5 seconds
      expect(SimpleCache.get('expiring')).toBeNull();

      jest.useRealTimers();
    });

    it('should return value before TTL expires', () => {
      jest.useFakeTimers();

      SimpleCache.set('valid', 'data', 5000); // 5 second TTL

      jest.advanceTimersByTime(3000); // advance 3 seconds
      expect(SimpleCache.get('valid')).toBe('data');

      jest.useRealTimers();
    });

    it('should use default TTL of 5 minutes when not specified', () => {
      jest.useFakeTimers();

      SimpleCache.set('default-ttl', 'data');

      jest.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(SimpleCache.get('default-ttl')).toBe('data');

      jest.advanceTimersByTime(2 * 60 * 1000); // +2 minutes = 6 total
      expect(SimpleCache.get('default-ttl')).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      SimpleCache.set('a', 1);
      SimpleCache.set('b', 2);
      SimpleCache.set('c', 3);

      SimpleCache.clear();

      expect(SimpleCache.get('a')).toBeNull();
      expect(SimpleCache.get('b')).toBeNull();
      expect(SimpleCache.get('c')).toBeNull();
    });
  });

  describe('overwrite behavior', () => {
    it('should overwrite existing key', () => {
      SimpleCache.set('key', 'old');
      SimpleCache.set('key', 'new');

      expect(SimpleCache.get('key')).toBe('new');
    });
  });
});
