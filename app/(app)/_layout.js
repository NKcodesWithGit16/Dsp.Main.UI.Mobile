import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import RoleGate from '../../src/components/RoleGate';
import { glass } from '../../src/theme/colors';

const TABS = [
  { name: 'home',      icon: 'home-outline',        activeIcon: 'home',         label: 'Home'    },
  { name: 'drivers',   icon: 'car-outline',          activeIcon: 'car',          label: 'Drivers' },
  { name: 'loadboard', icon: 'layers-outline',       activeIcon: 'layers',       label: 'Loads'   },
  { name: 'documents', icon: 'folder-open-outline',  activeIcon: 'folder-open',  label: 'Docs'    },
  { name: 'aichat',    icon: 'sparkles-outline',     activeIcon: 'sparkles',     label: 'AI'      },
];

function TabIcon({ focused, label, icon, activeIcon, colors }) {
  return (
    <View style={tabS.wrap}>
      {/* Pill contains both the gradient and the icon so overflow:hidden clips cleanly */}
      <View style={tabS.pill}>
        {focused && (
          <LinearGradient
            colors={['#6366f1', '#4f46e5']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        )}
        <Ionicons
          name={focused ? activeIcon : icon}
          size={20}
          color={focused ? '#fff' : colors.textMuted}
        />
      </View>
      <Text style={[tabS.label, { color: focused ? colors.accent : colors.textDisabled }]}>
        {label}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const fill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const border = isDark ? glass.borderDark : 'rgba(99,102,241,0.18)';
  const blurIntensity = Platform.OS === 'ios'
    ? (isDark ? glass.blurIosDark  : glass.blurIosLight)
    : (isDark ? glass.blurAndDark  : glass.blurAndLight);

  return (
    <RoleGate allow="dispatcher">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            height: 64 + insets.bottom,
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
              {/* Top border line replacing the native borderTopWidth */}
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
                  activeIcon={t.activeIcon}
                  colors={colors}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </RoleGate>
  );
}

const tabS = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 4,
  },
  pill: {
    width: 52,
    height: 30,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
