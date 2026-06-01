import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import log from '../../utils/logger';

/**
 * Root-level error boundary. Catches render errors that would otherwise
 * white-screen the app, shows a brand-aligned fallback, and gives the user
 * a Try-Again button that re-mounts the subtree. Wire crash reporting in
 * `componentDidCatch` once a service is picked.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    log.error('ErrorBoundary', error?.message || 'Unknown error', error, info?.componentStack);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;

    const isDev = !!__DEV__;
    const msg = this.state.error?.message || 'Unknown error';

    return (
      <View style={styles.wrap}>
        <LinearGradient
          colors={['#04285a', '#0a3d7d', '#0193ab']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <View style={styles.iconBubble}>
            <Text style={styles.iconText}>!</Text>
          </View>
          <Text style={styles.title}>Something broke</Text>
          <Text style={styles.sub}>
            The app hit an unexpected error. Tap below to try again — your work isn't lost.
          </Text>

          <Pressable
            onPress={this.reset}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>

          {isDev ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>DEV details</Text>
              <Text style={styles.devText} numberOfLines={6}>{msg}</Text>
              {this.state.info?.componentStack ? (
                <Text style={[styles.devText, { marginTop: 8, opacity: 0.7 }]} numberOfLines={10}>
                  {this.state.info.componentStack.trim()}
                </Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#04285a' },
  scroll: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    padding: 28, gap: 14,
  },
  iconBubble: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
  sub: {
    color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20,
    textAlign: 'center', maxWidth: 320, marginTop: 4,
  },
  btn: {
    marginTop: 18,
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  btnText: { color: '#04285a', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  devBox: {
    marginTop: 28,
    padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    maxWidth: 360, width: '100%',
  },
  devLabel: { color: '#fbbf24', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  devText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
});
