import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../src/context/ThemeContext';
import RoleGate from '../../src/components/RoleGate';
import { glass, gradients } from '../../src/theme/colors';
import Icon from '../../src/components/shared/Icon';
import FAB from '../../src/components/shared/FAB';

const TABS = [
  { name: 'home',      icon: 'home',     label: 'Home'    },
  { name: 'drivers',   icon: 'truck',    label: 'Drivers' },
  { name: 'loadboard', icon: 'box',      label: 'Loads'   },
  { name: 'documents', icon: 'folder',   label: 'Docs'    },
  { name: 'aichat',    icon: 'sparkles', label: 'AI'      },
];

function TabIcon({ focused, label, icon, colors, badge }) {
  // Bigger lift + scale on active → noticeable "pop" instead of subtle nudge.
  const fade = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const lift = useRef(new Animated.Value(focused ? -6 : 0)).current;
  const scale = useRef(new Animated.Value(focused ? 1.1 : 1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: focused ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(lift, { toValue: focused ? -6 : 0, damping: 18, stiffness: 280, mass: 0.7, useNativeDriver: true }),
      Animated.spring(scale, { toValue: focused ? 1.1 : 1, damping: 18, stiffness: 280, mass: 0.7, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  const labelFade = useRef(new Animated.Value(focused ? 1 : 0.7)).current;
  useEffect(() => {
    Animated.timing(labelFade, { toValue: focused ? 1 : 0.7, duration: 180, useNativeDriver: true }).start();
  }, [focused]);

  return (
    <Animated.View style={[tabS.wrap, { transform: [{ translateY: lift }] }]}>
      <Animated.View style={[tabS.pillOuter, { transform: [{ scale }] }]}>
        <View style={tabS.pill}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
            <LinearGradient
              colors={gradients.brand}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
          <Icon
            name={icon}
            size={19}
            color={focused ? '#fff' : colors.textMuted}
          />
        </View>
        {badge != null && badge > 0 ? (
          <View style={tabS.badge}>
            <Text style={tabS.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Animated.Text style={[
        tabS.label,
        { color: focused ? colors.accent : colors.textDisabled, fontWeight: focused ? '800' : '600', opacity: labelFade },
      ]}>
        {label}
      </Animated.Text>
      {/* Slim indicator line under the active tab — Instagram-style */}
      {focused ? (
        <Animated.View style={[tabS.indicator, { opacity: fade, backgroundColor: colors.accent }]} />
      ) : null}
    </Animated.View>
  );
}

export default function AppLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const fill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const border = isDark ? glass.borderDark : 'rgba(1,147,171,0.18)';
  const blurIntensity = Platform.OS === 'ios'
    ? (isDark ? glass.blurIosDark  : glass.blurIosLight)
    : (isDark ? glass.blurAndDark  : glass.blurAndLight);

  return (
    <RoleGate allow="dispatcher">
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              height: 68 + insets.bottom,
              paddingBottom: insets.bottom,
              elevation: 0,
              shadowOpacity: 0,
            },
            tabBarItemStyle: {
              paddingTop: 8,
              paddingBottom: 0,
            },
            tabBarBackground: () => (
              <>
                <BlurView
                  intensity={blurIntensity}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { backgroundColor: fill }]}
                />
                {!isDark && (
                  <LinearGradient
                    colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    pointerEvents="none"
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 14 }}
                  />
                )}
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: border,
                  }}
                />
              </>
            ),
          }}
        >
          {TABS.map(t => (
            <Tabs.Screen
              key={t.name}
              name={t.name}
              options={{
                tabBarIcon: ({ focused }) => (
                  <TabIcon
                    focused={focused}
                    label={t.label}
                    icon={t.icon}
                    colors={colors}
                  />
                ),
              }}
            />
          ))}
        </Tabs>
        {/* Floating "+" — quick actions sheet, always reachable */}
        <FAB bottom={68 + insets.bottom + 16} />
      </View>
    </RoleGate>
  );
}

const tabS = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
  },
  pillOuter: {
    width: 52,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    width: 52,
    height: 32,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  badge: {
    position: 'absolute',
    top: -4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  indicator: {
    position: 'absolute', bottom: -6, alignSelf: 'center',
    width: 18, height: 2, borderRadius: 1,
  },
});
