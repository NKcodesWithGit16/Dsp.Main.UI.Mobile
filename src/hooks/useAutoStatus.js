import { useEffect, useRef, useState } from 'react';
import { sendDriverHeartbeat } from '../api/main';

const REASON_LABELS = {
  Unknown:    { label: 'Connecting…',       sub: 'Waiting for GPS' },
  Driving:    { label: 'Driving',           sub: 'On route' },
  AtPickup:   { label: 'At pickup',         sub: 'Within range of pickup location' },
  AtDelivery: { label: 'At delivery',       sub: 'Within range of dropoff location' },
  Traffic:    { label: 'Stopped — traffic', sub: 'Brief halt on the planned route' },
  Stopped:    { label: 'Stopped',           sub: 'Idle on planned route for >15 min' },
  OffRoute:   { label: 'Off route',         sub: 'Outside the planned corridor' },
  Offline:    { label: 'Offline',           sub: 'No GPS signal' },
};

const STATUS_KEY_FROM_SERVER = (s) => {
  if (!s) return 'moving';
  const k = String(s).toLowerCase();
  if (k === 'moving' || k === 'idle' || k === 'offline') return k;
  return 'moving';
};

/**
 * Mobile mirror of the web `useAutoStatus`: pushes driver heartbeats
 * (60s while moving, 180s while idle — server-driven cadence) and
 * surfaces the resulting status + activity reason back to the UI.
 *
 * `currentPosition` is { latitude, longitude } (React Native convention).
 */
export function useAutoStatus(driverId, currentPosition, speedMph) {
  const [status, setStatus]         = useState('moving');
  const [reason, setReason]         = useState('Unknown');
  const [etaUtc, setEtaUtc]         = useState(null);
  const [minutesRemaining, setMinutes] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);

  const nextDelayRef = useRef(60_000);
  const positionRef  = useRef(currentPosition);
  const speedRef     = useRef(speedMph);

  positionRef.current = currentPosition;
  speedRef.current    = speedMph;

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    let timer = null;

    async function pulse() {
      const pos = positionRef.current;
      if (pos) {
        const speedKph = (speedRef.current ?? 0) / 0.621371;
        try {
          const result = await sendDriverHeartbeat(driverId, {
            lat: pos.latitude,
            lng: pos.longitude,
            speedKph,
          });
          if (cancelled) return;
          if (result) {
            setStatus(STATUS_KEY_FROM_SERVER(result.status));
            setReason(result.reason ?? 'Unknown');
            setEtaUtc(result.etaUtc ?? null);
            setMinutes(result.minutesRemaining ?? null);
            setIsOffRoute(!!result.isOffRoute);
            nextDelayRef.current = (result.nextHeartbeatSeconds ?? 60) * 1000;
          }
        } catch {
          // network/server hiccup — keep last state, retry next tick
        }
      }
      if (!cancelled) timer = setTimeout(pulse, nextDelayRef.current);
    }

    timer = setTimeout(pulse, 2_000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [driverId]);

  const reasonInfo = REASON_LABELS[reason] ?? REASON_LABELS.Unknown;

  return {
    status,
    reason,
    reasonLabel: reasonInfo.label,
    reasonSub:   reasonInfo.sub,
    etaUtc,
    minutesRemaining,
    isOffRoute,
  };
}
