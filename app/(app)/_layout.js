import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/context/ThemeContext';

const TABS = [
  { name: 'home',      icon: '⌂',  label: 'Home' },
  { name: 'drivers',   icon: '🚛', label: 'Drivers' },
  { name: 'loadboard', icon: '📋', label: 'Loads' },
  { name: 'documents', icon: '📁', label: 'Docs' },
  { name: 'aichat',    icon: '✦',  label: 'AI' },
];

function TabIcon({ focused, label, icon, colors }) {
  return (
    <View style={tabS.wrap}>
      {focused && (
        <LinearGradient
          colors={['#6366f1', '#4f46e5']}
          style={tabS.activePill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      )}
      <Text style={[tabS.icon, { color: focused ? '#fff' : colors.textMuted, opacity: focused ? 1 : 0.7 }]}>
        {icon}
      </Text>
      <Text style={[tabS.label, { color: focused ? colors.accent : colors.textDisabled }]}>
        {label}
      </Text>
    </View>
  );
}

export default function AppLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface1,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        tabBarShowLabel: false,
      }}
    >
      {TABS.map(t => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} label={t.label} icon={t.icon} colors={colors} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const tabS = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 52, paddingVertical: 4 },
  activePill: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 28,
    borderRadius: 9,
  },
  icon: { fontSize: 18, zIndex: 1 },
  label: { fontSize: 9, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
});
