import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, typography, spacing } from '../../theme/colors';
import Icon from './Icon';
import AnimatedPressable from './AnimatedPressable';

/**
 * Floating-label text input.
 *
 *   • Label sits inside the input at rest, lifts + shrinks on focus / value
 *   • Animated 1.5px teal focus ring with soft glow
 *   • Optional leading icon (kept) and trailing show/hide eye for passwords
 *   • Error state colors the border red and shows a message line below
 */
export default function FloatingLabelInput({
  label,
  value,
  onChangeText,
  onBlur,
  icon,
  secureTextEntry,
  error,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  style,
}) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused]   = useState(false);
  const [secure, setSecure]     = useState(!!secureTextEntry);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const glow      = useRef(new Animated.Value(0)).current;

  const floated = focused || (value && value.length > 0);

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: floated ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [floated]);

  useEffect(() => {
    Animated.timing(glow, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const labelTop = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [16, -8] });
  const labelSize = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [typography.base, 11] });

  const ringColor = error
    ? '#ef4444'
    : focused
      ? colors.accent
      : colors.border;

  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.78)';

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View
        style={[
          styles.shell,
          {
            backgroundColor: inputBg,
            borderColor: ringColor,
            borderWidth: focused || error ? 1.6 : 1.2,
            shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
            shadowColor: error ? '#ef4444' : colors.accent,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        {icon ? (
          <View style={styles.iconWrap}>
            <Icon name={icon} size={17} color={focused ? colors.accent : colors.textMuted} />
          </View>
        ) : null}

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.label,
              {
                top: labelTop,
                fontSize: labelSize,
                color: error
                  ? '#ef4444'
                  : focused
                    ? colors.accent
                    : colors.textMuted,
                backgroundColor: floated
                  ? (isDark ? '#08090e' : '#ffffff')
                  : 'transparent',
                paddingHorizontal: floated ? 4 : 0,
                left: icon ? 0 : 4,
              },
            ]}
          >
            {label}
          </Animated.Text>

          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={(e) => { setFocused(false); onBlur && onBlur(e); }}
            secureTextEntry={secureTextEntry && secure}
            keyboardType={keyboardType || 'default'}
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            textContentType={textContentType}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            placeholderTextColor="transparent"
          />
        </View>

        {secureTextEntry ? (
          <AnimatedPressable
            onPress={() => setSecure(s => !s)}
            hapticStyle="light"
            pressedScale={0.88}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.trail}>
              <Icon name={secure ? 'eye' : 'eyeOff'} size={17} color={colors.textMuted} />
            </View>
          </AnimatedPressable>
        ) : null}
      </Animated.View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[4] },
  shell: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minHeight: 54,
    elevation: 0,
  },
  iconWrap: { marginRight: spacing[2] },
  label: {
    position: 'absolute',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  input: {
    fontSize: typography.base,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? spacing[3] : spacing[2],
    paddingTop: spacing[3] + 2,
    paddingBottom: spacing[2],
    minHeight: 48,
  },
  trail: {
    marginLeft: spacing[2],
    padding: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: typography.xs,
    marginTop: 4,
    fontWeight: '700',
    paddingHorizontal: spacing[1],
  },
});
