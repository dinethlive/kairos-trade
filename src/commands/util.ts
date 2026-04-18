// Parse an on/off CLI argument. Returns `null` when the raw value isn't a
// recognised boolean — callers report their own usage string.
export function parseOnOff(raw: string | undefined): boolean | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === 'on' || v === 'true' || v === '1') return true;
  if (v === 'off' || v === 'false' || v === '0') return false;
  return null;
}
