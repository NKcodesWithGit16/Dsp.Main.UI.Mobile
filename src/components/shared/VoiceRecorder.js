import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, PanResponder, Animated, Alert, Platform, Pressable,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
} from 'expo-audio';

function MicIcon({ size = 18, color = '#666' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="12" rx="3" stroke={color} strokeWidth="1.8" />
      <Path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 18v3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function ChevLeftIcon({ size = 12, color = '#ef4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M8 2.5L4 6L8 9.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockIcon({ size = 12, color = '#ef4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Rect x="3" y="6.5" width="8" height="6" rx="1" stroke={color} strokeWidth="1.5" />
      <Path d="M5 6.5V4.5C5 3.4 5.9 2.5 7 2.5C8.1 2.5 9 3.4 9 4.5V6.5" stroke={color} strokeWidth="1.5" />
    </Svg>
  );
}

function CloseIcon({ size = 11, color = '#ef4444' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2 2L12 12M12 2L2 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function SendIcon({ size = 16, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M3 10L17 3L10 17L9 11L3 10Z" fill={color} />
    </Svg>
  );
}

const PEAK_COUNT = 48;
const CANCEL_THRESHOLD = 90;       // px slide-left before cancellation
const LOCK_THRESHOLD = 60;         // px slide-up before locking hands-free
const SAMPLE_INTERVAL_MS = 80;

// Voice-optimized AAC preset. Mono + 32 kbps is plenty for clear speech and
// keeps file size tiny (~240 KB/min) — matches the WhatsApp profile.
const VOICE_PRESET = {
  ...RecordingPresets.HIGH_QUALITY,
  android: {
    ...RecordingPresets.HIGH_QUALITY.android,
    numberOfChannels: 1,
    bitRate: 32000,
    sampleRate: 48000,
  },
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    numberOfChannels: 1,
    bitRate: 32000,
    sampleRate: 48000,
  },
  isMeteringEnabled: true,
};

function fmtTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

// dB metering (-160..0) → 0..100 amplitude. Voice typically sits around -30 to -5 dB.
function meteringToAmplitude(db) {
  if (db == null || !Number.isFinite(db)) return 6;
  const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
  return Math.round(normalized * 100);
}

function compressPeaks(peaks, target) {
  if (!peaks?.length) return new Array(target).fill(8);
  if (peaks.length <= target) {
    const avg = Math.round(peaks.reduce((a, b) => a + b, 0) / peaks.length) || 8;
    return [...peaks, ...new Array(target - peaks.length).fill(avg)];
  }
  const step = peaks.length / target;
  const out = [];
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let max = 0;
    for (let j = start; j < end; j++) if (peaks[j] > max) max = peaks[j];
    out.push(Math.max(4, Math.min(100, max)));
  }
  return out;
}

export default function VoiceRecorder({ onSend, onRecordingChange, disabled, colors, gradients, isDark }) {
  const recorder = useAudioRecorder(VOICE_PRESET);
  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState(() => new Array(PEAK_COUNT).fill(4));
  const dragX = useRef(new Animated.Value(0)).current;
  const cancelledRef = useRef(false);
  const lockedRef = useRef(false);
  const peaksRef = useRef([]);
  const startTsRef = useRef(0);
  const elapsedTimerRef = useRef(0);
  const meterTimerRef = useRef(0);
  const dragXValRef = useRef(0);

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(() => () => {
    clearInterval(elapsedTimerRef.current);
    clearInterval(meterTimerRef.current);
    try { recorder?.stop?.(); } catch {}
  }, [recorder]);

  // Watch the live drag value so cancel triggers as soon as the threshold is crossed.
  useEffect(() => {
    const id = dragX.addListener(({ value }) => { dragXValRef.current = value; });
    return () => dragX.removeListener(id);
  }, [dragX]);

  const startRecording = useCallback(async () => {
    if (disabled || recording) return;
    cancelledRef.current = false;
    peaksRef.current = [];
    setBars(new Array(PEAK_COUNT).fill(4));
    setElapsed(0);
    dragX.setValue(0);

    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone blocked',
          'Enable microphone access in Settings to send voice messages.',
        );
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      startTsRef.current = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTsRef.current) / 1000);
      }, 200);

      // Sample metering on a separate, faster timer so the waveform feels live
      // even though the elapsed-clock updates every 200 ms.
      meterTimerRef.current = setInterval(() => {
        const status = typeof recorder.getStatus === 'function' ? recorder.getStatus() : recorder;
        const amp = meteringToAmplitude(status?.metering);
        peaksRef.current.push(amp);
        setBars((prev) => {
          const next = prev.slice(1);
          next.push(Math.max(4, amp));
          return next;
        });
      }, SAMPLE_INTERVAL_MS);

      setRecording(true);
    } catch (err) {
      console.warn('voice record start failed', err);
      Alert.alert('Recording failed', 'Could not start the microphone. Try again.');
    }
  }, [disabled, recording, recorder, dragX]);

  const stopAndMaybeSend = useCallback(async (cancel) => {
    if (!recording) return;
    clearInterval(elapsedTimerRef.current);
    clearInterval(meterTimerRef.current);
    elapsedTimerRef.current = 0;
    meterTimerRef.current = 0;

    const durationSeconds = (Date.now() - startTsRef.current) / 1000;
    const collected = peaksRef.current.slice();

    let uri = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (err) {
      console.warn('recorder.stop failed', err);
    }

    setRecording(false);
    setLocked(false);
    lockedRef.current = false;
    Animated.timing(dragX, { toValue: 0, duration: 140, useNativeDriver: true }).start();

    if (cancel || durationSeconds < 0.6 || !uri) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const compressedPeaks = compressPeaks(collected, PEAK_COUNT);
    const mimeType = Platform.OS === 'ios' ? 'audio/mp4' : 'audio/mp4';

    try {
      await onSend?.({
        audioUri: uri,
        mimeType,
        durationSeconds,
        peaks: compressedPeaks,
      });
    } catch (err) {
      console.warn('voice send failed', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Couldn\'t send', 'The voice message could not be sent. Please try again.');
    }
  }, [recording, recorder, onSend, dragX]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRecording();
      },
      onPanResponderMove: (_, g) => {
        if (lockedRef.current) return;            // ignore drags after lock
        const dx = Math.min(0, g.dx);
        dragX.setValue(dx);
        // Slide LEFT past threshold → cancel.
        if (dx <= -CANCEL_THRESHOLD && !cancelledRef.current) {
          cancelledRef.current = true;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          stopAndMaybeSend(true);
          return;
        }
        // Slide UP past threshold → lock hands-free.
        if (g.dy <= -LOCK_THRESHOLD && !cancelledRef.current) {
          lockedRef.current = true;
          setLocked(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          Animated.timing(dragX, { toValue: 0, duration: 140, useNativeDriver: true }).start();
        }
      },
      onPanResponderRelease: () => {
        if (cancelledRef.current || lockedRef.current) return;
        stopAndMaybeSend(false);
      },
      onPanResponderTerminate: () => {
        if (cancelledRef.current || lockedRef.current) return;
        stopAndMaybeSend(true);
      },
    }),
  ).current;

  const cancelOpacity = dragX.interpolate({
    inputRange: [-CANCEL_THRESHOLD, 0],
    outputRange: [0.4, 1],
    extrapolate: 'clamp',
  });
  const cancelColor = dragX.interpolate({
    inputRange: [-CANCEL_THRESHOLD, -CANCEL_THRESHOLD / 2, 0],
    outputRange: ['#ef4444', '#ef4444', colors?.textMuted || '#888'],
    extrapolate: 'clamp',
  });

  // Locked / hands-free recording — buttons handle their own taps, so no
  // panHandlers on the wrapper (otherwise the PanResponder would intercept).
  if (locked) {
    return (
      <View style={[styles.recBar, { backgroundColor: 'rgba(1,147,171,0.10)', borderColor: 'rgba(1,147,171,0.42)' }]}>
        <Pressable
          onPress={() => stopAndMaybeSend(true)}
          style={({ pressed }) => [styles.lockedCancel, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityLabel="Cancel recording"
        >
          <CloseIcon size={11} color="#ef4444" />
        </Pressable>
        <View style={styles.recDot} />
        <Text style={styles.recTime}>{fmtTime(elapsed)}</Text>
        <View style={styles.recWave} pointerEvents="none">
          {bars.map((h, i) => (
            <View
              key={i}
              style={[styles.recTick, { height: Math.max(3, Math.min(28, h * 0.28 + 3)) }]}
            />
          ))}
        </View>
        <Pressable
          onPress={() => stopAndMaybeSend(false)}
          style={({ pressed }) => [styles.lockedSend, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityLabel="Send voice message"
        >
          <SendIcon size={16} color="#fff" />
        </Pressable>
      </View>
    );
  }

  // Idle (mic button) or holding (recording bar) — PanResponder lives on the
  // outer wrapper so the gesture is never lost when inner content swaps.
  return (
    <View style={styles.outer}>
      {recording && (
        <View style={styles.lockHint} pointerEvents="none">
          <LockIcon size={12} color="#ef4444" />
          <Text style={styles.lockHintText}>Slide up to lock</Text>
        </View>
      )}
      <Animated.View
        {...pan.panHandlers}
        style={[
          recording ? styles.recBar : styles.micBtnWrap,
          recording && { transform: [{ translateX: Animated.multiply(dragX, 0.4) }] },
          !recording && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : (colors?.surface2 || '#f1f5f9'),
            borderColor: colors?.border || 'rgba(0,0,0,0.08)',
            opacity: disabled ? 0.4 : 1,
          },
        ]}
        accessibilityLabel={recording ? 'Recording — slide left to cancel, slide up to lock' : 'Hold to record voice message'}
      >
        {recording ? (
          <>
            <View style={styles.recDot} />
            <Text style={styles.recTime}>{fmtTime(elapsed)}</Text>
            <View style={styles.recWave} pointerEvents="none">
              {bars.map((h, i) => (
                <View
                  key={i}
                  style={[styles.recTick, { height: Math.max(3, Math.min(28, h * 0.28 + 3)) }]}
                />
              ))}
            </View>
            <Animated.View style={[styles.recHint, { opacity: cancelOpacity }]}>
              <ChevLeftIcon size={11} color="#ef4444" />
              <Animated.Text style={[styles.recHintText, { color: cancelColor }]}>
                Slide to cancel
              </Animated.Text>
            </Animated.View>
          </>
        ) : (
          <MicIcon size={18} color={colors?.textMuted || '#666'} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wraps the bar + lock-hint so the floating hint can position above the bar.
  outer: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  lockHint: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    marginBottom: 8,
    transform: [{ translateX: -70 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.36)',
  },
  lockHintText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  lockedCancel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedSend: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0193ab',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0193ab',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  micBtnWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  recBar: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.36)',
    overflow: 'hidden',
  },
  recDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recTime: {
    fontVariant: ['tabular-nums'],
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ef4444',
    minWidth: 32,
  },
  recWave: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    overflow: 'hidden',
  },
  recTick: {
    width: 2,
    backgroundColor: '#ef4444',
    borderRadius: 1,
    minHeight: 3,
  },
  recHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recHintText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
