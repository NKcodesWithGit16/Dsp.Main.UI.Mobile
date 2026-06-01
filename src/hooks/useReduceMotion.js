import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Returns true when the OS user has enabled the "reduce motion" preference.
 * Use to short-circuit long-running loops (KenBurns, pulses) for vestibular
 * accessibility compliance.
 */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (mounted) setReduce(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (v) => mounted && setReduce(!!v),
    );
    return () => {
      mounted = false;
      if (sub && typeof sub.remove === 'function') sub.remove();
    };
  }, []);

  // On web RN, AccessibilityInfo may not exist — default false.
  if (Platform.OS === 'web') return false;
  return reduce;
}
