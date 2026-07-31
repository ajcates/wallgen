/**
 * Data utilities for smoothing and interpolating log data.
 */

/**
 * Calculates a Simple Moving Average (SMA) for a specific key in the data array.
 * @param {Array} data - Array of log entries.
 * @param {string} key - The data field to smooth (e.g., 'bp', 'fm').
 * @param {number} windowSize - The number of entries to average.
 * @returns {number} The smoothed value.
 */
export function getSMA(data, key, windowSize = 5) {
  if (!data || data.length === 0) return 0;
  const slice = data.slice(-windowSize);
  const sum = slice.reduce((acc, entry) => acc + (entry[key] || 0), 0);
  return sum / slice.length;
}

/**
 * Calculates an Exponential Moving Average (EMA).
 * Useful for giving more weight to recent data while still smoothing jitter.
 * @param {Array} data - Array of log entries.
 * @param {string} key - The data field to smooth.
 * @param {number} alpha - Smoothing factor (0 to 1). Higher = more weight to recent data.
 * @returns {number} The smoothed value.
 */
export function getEMA(data, key, alpha = 0.3) {
  if (!data || data.length === 0) return 0;
  if (data.length === 1) return data[0][key] || 0;

  let ema = data[0][key] || 0;
  for (let i = 1; i < data.length; i++) {
    const val = data[i][key] || 0;
    ema = alpha * val + (1 - alpha) * ema;
  }
  return ema;
}

/**
 * Interpolates between two values.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
