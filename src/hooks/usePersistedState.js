import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import log from '../utils/logger';

const NAMESPACE = 'hitchlink.ui.';

/**
 * useState that persists JSON-serializable values to AsyncStorage.
 *
 *   const [sort, setSort] = usePersistedState('loadboard.sort', 'newest');
 *
 * The first render returns the default; once the stored value loads it
 * swaps in. Caller doesn't need to wait — the lazy default is correct.
 */
export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const hydrated = useRef(false);
  const storageKey = NAMESPACE + key;

  // Load once on mount
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (cancelled || raw == null) return;
        try {
          setValue(JSON.parse(raw));
        } catch (e) {
          log.warn('usePersistedState', `bad json for ${storageKey}`, e);
        }
      })
      .catch((e) => log.warn('usePersistedState', `read fail ${storageKey}`, e))
      .finally(() => { hydrated.current = true; });
    return () => { cancelled = true; };
  }, [storageKey]);

  // Persist on change (after hydration so we don't overwrite stored with default)
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(storageKey, JSON.stringify(value))
      .catch((e) => log.warn('usePersistedState', `write fail ${storageKey}`, e));
  }, [storageKey, value]);

  return [value, setValue];
}
