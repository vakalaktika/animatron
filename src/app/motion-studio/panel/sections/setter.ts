/** Immutable field setter for a clip section: `set("x", 10)` emits a fresh clip. */
export function setter<C>(clip: C, onChange: (next: C) => void) {
  return <K extends keyof C>(key: K, value: C[K]) => onChange({ ...clip, [key]: value });
}
