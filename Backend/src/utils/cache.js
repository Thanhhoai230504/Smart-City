/**
 * Simple in-memory cache with TTL
 * Used for caching TomTom Traffic API responses (5 minutes)
 */
class SimpleCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get value from cache if not expired
   * @param {string} key
   * @returns {*} cached value or null
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set value in cache with TTL
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs - Time to live in milliseconds
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }
}

// Export singleton instance
module.exports = new SimpleCache();
