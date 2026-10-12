import { useEffect, useState } from 'react';
import { readStored, writeStored } from './storage';
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial));
  useEffect(() => {
    writeStored(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
