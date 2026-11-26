// Exact comparison of detached data records, independent of object key order.
// Array order is meaningful. No digest collisions or browser-only dependencies.
/** @param {unknown} a @param {unknown} b @returns {boolean} */
export function sameRecordValue(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return Object.is(a, b) && ['undefined', 'boolean', 'number', 'string', 'object'].includes(typeof a);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
  } else if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) {
    return false;
  }
  if (Object.getOwnPropertySymbols(a).length || Object.getOwnPropertySymbols(b).length) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    const left = Object.getOwnPropertyDescriptor(a, key);
    const right = Object.getOwnPropertyDescriptor(b, key);
    if (!left || !right || !right.enumerable || !('value' in left) || !('value' in right) ||
        !sameRecordValue(left.value, right.value)) return false;
  }
  return true;
}
