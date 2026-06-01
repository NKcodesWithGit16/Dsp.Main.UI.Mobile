import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, PanResponder,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { audioFullUrl } from '../../api/main';

const PEAK_COUNT = 48;
const SPEEDS = [1, 1.5, 2];

// Module-level set of currently-active players so starting one pauses any
// others — matches WhatsApp behavior, prevents two voice notes overlapping.
const liveControllers = new Set();

function PlayIcon({ size = 13, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M4 2.5L11.5 7L4 11.5V2.5Z" fill={color} />
    </Svg>
  );
}

function PauseIcon({ size = 13, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Rect x="3" y="2.5" width="2.5" height="9" rx="0.6" fill={color} />
      <Rect x="8.5" y="2.5" width="2.5" height="9" rx="0.6" fill={color} />
    </Svg>
  );
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const total = Math.floor(s);
  const m = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

function parsePeaks(str) {
  if (!str) return new Array(PEAK_COUNT).fill(18);
  const arr = String(str).split(',').map(n => Number(n) || 0);
  if (arr.length === PEAK_COUNT) return arr;
  const out = new Array(PEAK_COUNT);
  for (let i = 0; i < PEAK_COUNT; i++) {
    const idx = (i / PEAK_COUNT) * arr.length;
    const lo = Math.floor(idx);
    const hi = Math.min(arr.length - 1, lo + 1);
    const t = idx - lo;
    out[i] = Math.round(arr[lo] * (1 - t) + arr[hi] * t);
  }
  return out;
}

export default function VoiceMessage({ message, fromMe, colors, isDark }) {
  const audioUrl = useMemo(() => audioFullUrl(message?.audioUrl), [message?.audioUrl]);
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  const [speed, setSpeed] = useState(1);
  const waveLayoutRef = useRef({ x: 0, width: 0 });

  const bars = useMemo(
    () => parsePeaks(message?.waveformPeaks),
    [message?.waveformPeaks],
  );

  const duration = status?.duration && status.duration > 0
    ? status.duration
    : (message?.durationSeconds || 0);
  const playing = !!status?.playing;
  const currentTime = status?.currentTime || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // Coordinate with sibling players: pause others on play, clean up on unmount.
  useEffect(() => {
    const controller = {
      pause: () => { try { player.pause(); } catch {} },
    };
    if (playing) {
      for (const other of liveControllers) {
        if (other !== controller) other.pause();
      }
      liveControllers.add(controller);
    }
    return () => liveControllers.delete(controller);
  }, [playing, player]);

  useEffect(() => () => {
    // expo-audio recommends releasing the player when the component unmounts.
    try { player.remove?.(); } catch {}
  }, [player]);

  useEffect(() => {
    if (typeof player.setPlaybackRate === 'function') {
      try { player.setPlaybackRate(speed); } catch {}
    } else {
      try { player.playbackRate = speed; } catch {}
    }
  }, [speed, player]);

  const togglePlay = () => {
    if (playing) {
      player.pause();
    } else {
      if (progress >= 0.999) {
        try { player.seekTo?.(0); } catch {}
      }
      player.play();
    }
  };

  const seekToRatio = (ratio) => {
    if (!duration) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    try { player.seekTo?.(clamped * duration); } catch {}
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { width } = waveLayoutRef.current;
        if (!width) return;
        seekToRatio((e.nativeEvent.locationX || 0) / width);
      },
      onPanResponderMove: (e) => {
        const { width } = waveLayoutRef.current;
        if (!width) return;
        seekToRatio((e.nativeEvent.locationX || 0) / width);
      },
    }),
  ).current;

  const cycleSpeed = () => {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  };

  const playBg = fromMe ? 'rgba(255,255,255,0.22)' : 'rgba(1,147,171,0.14)';
  const playFg = fromMe ? '#fff' : '#0193ab';
  const tickBg = fromMe ? 'rgba(255,255,255,0.42)' : 'rgba(1,147,171,0.28)';
  const tickFill = fromMe ? '#fff' : '#0193ab';
  const timeColor = fromMe ? 'rgba(255,255,255,0.92)' : (colors?.textMuted || '#64748b');
  const speedBg = fromMe ? 'rgba(255,255,255,0.22)' : 'rgba(1,147,171,0.12)';
  const speedFg = fromMe ? '#fff' : '#0193ab';

  return (
    <View style={styles.container}>
      <Pressable
        onPress={togglePlay}
        style={({ pressed }) => [styles.playBtn, { backgroundColor: playBg, opacity: pressed ? 0.85 : 1 }]}
        accessibilityLabel={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <PauseIcon color={playFg} /> : <PlayIcon color={playFg} />}
      </Pressable>
      <View
        {...pan.panHandlers}
        style={styles.wave}
        onLayout={(e) => {
          waveLayoutRef.current = e.nativeEvent.layout;
        }}
      >
        {bars.map((h, i) => {
          const filled = (i / bars.length) < progress;
          return (
            <View
              key={i}
              style={[
                styles.tick,
                {
                  height: Math.max(4, Math.min(24, h * 0.22 + 4)),
                  backgroundColor: filled ? tickFill : tickBg,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.meta}>
        <Text style={[styles.time, { color: timeColor }]}>
          {fmtTime(playing ? duration * progress : duration)}
        </Text>
        <Pressable
          onPress={cycleSpeed}
          style={[styles.speedBtn, { backgroundColor: speedBg }]}
          accessibilityLabel={`Playback speed ${speed}x`}
        >
          <Text style={[styles.speedText, { color: speedFg }]}>{speed}×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 200,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
    overflow: 'hidden',
  },
  tick: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1,
    minHeight: 4,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 3,
  },
  time: {
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    fontWeight: '600',
  },
  speedBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  speedText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
