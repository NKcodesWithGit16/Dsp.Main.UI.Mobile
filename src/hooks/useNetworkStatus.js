import { useEffect, useState } from 'react';
import { NativeModules } from 'react-native';

// Native module check: if RNCNetInfo isn't compiled into this build (Expo
// Go, or a dev client built before netinfo was added), we silently no-op.
// We have to check *before* touching the package — its top-level code
// evaluates the native module on import and throws synchronously.
const HAS_NATIVE = !!NativeModules.RNCNetInfo;

let _netInfo = null;
async function loadNetInfo() {
  if (!HAS_NATIVE) return false;
  if (_netInfo !== null) return _netInfo;
  try {
    _netInfo = (await import('@react-native-community/netinfo')).default;
  } catch {
    _netInfo = false;
  }
  return _netInfo;
}

/**
 * Returns { online, type } for the device's connectivity. When NetInfo is
 * unavailable, defaults to "online" — the offline banner just never shows.
 */
export function useNetworkStatus() {
  const [state, setState] = useState({ online: true, type: 'unknown' });

  useEffect(() => {
    let unsub;
    let cancelled = false;
    (async () => {
      const NI = await loadNetInfo();
      if (!NI || cancelled) return;
      try {
        const current = await NI.fetch();
        if (!cancelled) {
          setState({
            online: !!current.isConnected && current.isInternetReachable !== false,
            type: current.type || 'unknown',
          });
        }
        unsub = NI.addEventListener((s) => {
          setState({
            online: !!s.isConnected && s.isInternetReachable !== false,
            type: s.type || 'unknown',
          });
        });
      } catch {}
    })();
    return () => { cancelled = true; unsub && unsub(); };
  }, []);

  return state;
}
