import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Image,
  TextInput, ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { uploadDeliveryPhoto, confirmDelivery } from '../../api/main';

export default function DeliveryProofModal({ visible, onSuccess, onDismiss, load, userId, colors, isDark }) {
  const [photoUri, setPhotoUri] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Access', 'Please allow camera access in Settings to take delivery photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo Access', 'Please allow photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      let photoUrl = null;
      let fileName = null;

      if (photoUri) {
        const uploaded = await uploadDeliveryPhoto(photoUri);
        photoUrl = uploaded.url;
        fileName = uploaded.fileName;
      }

      await confirmDelivery(load.id, load.driverId, userId, photoUrl, fileName, notes.trim() || null);
      setPhotoUri(null);
      setNotes('');
      onSuccess?.();
    } catch (err) {
      Alert.alert('Submission Failed', 'Could not submit delivery confirmation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const bg = isDark ? 'rgba(10,15,28,0.92)' : 'rgba(255,255,255,0.95)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <BlurView intensity={isDark ? 80 : 60} tint={isDark ? 'dark' : 'light'} style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor }]}>
          <View style={s.handle} />

          <LinearGradient colors={['#10b981', '#059669']} style={s.iconWrap}>
            <Text style={s.icon}>✓</Text>
          </LinearGradient>

          <Text style={[s.title, { color: colors.textPrimary }]}>Confirm Delivery</Text>
          <Text style={[s.sub, { color: colors.textMuted }]} numberOfLines={2}>
            {load?.destination || 'Destination'}
          </Text>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent} showsVerticalScrollIndicator={false}>
            {/* Photo section */}
            <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Proof of Delivery</Text>

            {photoUri ? (
              <View style={s.previewWrap}>
                <Image source={{ uri: photoUri }} style={s.preview} resizeMode="cover" />
                <TouchableOpacity style={[s.changeBtn, { borderColor: colors.border }]} onPress={() => setPhotoUri(null)}>
                  <Text style={[s.changeBtnText, { color: colors.textMuted }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.photoButtons}>
                <TouchableOpacity
                  style={[s.photoBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accentLight }]}
                  onPress={pickFromCamera}
                  activeOpacity={0.75}
                >
                  <Text style={s.photoBtnIcon}>📷</Text>
                  <Text style={[s.photoBtnText, { color: colors.accent }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.photoBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accentLight }]}
                  onPress={pickFromLibrary}
                  activeOpacity={0.75}
                >
                  <Text style={s.photoBtnIcon}>🖼️</Text>
                  <Text style={[s.photoBtnText, { color: colors.accent }]}>Library</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Notes section */}
            <Text style={[s.sectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>Notes (optional)</Text>
            <TextInput
              style={[s.notesInput, {
                color: colors.textPrimary,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                borderColor: colors.border,
              }]}
              placeholder="Any delivery notes…"
              placeholderTextColor={colors.textDisabled}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={300}
            />
          </ScrollView>

          {/* Actions */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.skipBtn, { borderColor: colors.border }]}
              onPress={onDismiss}
              disabled={submitting}
              activeOpacity={0.75}
            >
              <Text style={[s.skipText, { color: colors.textMuted }]}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.submitWrap, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#10b981', '#059669']} style={s.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitText}>Submit Delivery</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.35)',
    marginBottom: 20,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: { fontSize: 26, color: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  body: { width: '100%' },
  bodyContent: { paddingBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  previewWrap: { alignItems: 'center', gap: 8 },
  preview: { width: '100%', height: 180, borderRadius: 12 },
  changeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  changeBtnText: { fontSize: 13 },
  photoButtons: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  photoBtnIcon: { fontSize: 24 },
  photoBtnText: { fontSize: 13, fontWeight: '600' },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  skipText: { fontSize: 15, fontWeight: '600' },
  submitWrap: { flex: 2 },
  submitBtn: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
