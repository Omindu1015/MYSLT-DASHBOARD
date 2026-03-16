const cache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Get data from cache or execute fetcher and store result
 * @param {string} key 
 * @param {Function} fetcher 
 */
export const withCache = async (key, fetcher) => {
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    const data = await fetcher();
    cache.set(key, { data, timestamp: now });
    return data;
};

/**
 * Generate a unique cache key from request query
 * @param {string} prefix 
 * @param {Object} query 
 */
export const getCacheKey = (prefix, query) => {
    return `${prefix}:${JSON.stringify(query)}`;
};

/**
 * Clear the cache (e.g. on new log ingestion if needed, though with 30s TTL it's usually fine)
 */
export const clearCache = () => {
    cache.clear();
};
