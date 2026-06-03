import React, { useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'];
export const FULL_PICKER     = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅', '👀', '🎉', '💯', '👏'];

const EDIT_MS              = 15 * 60 * 1000;
const DEL_FOR_EVERYONE_MS  = 60 * 60 * 1000;

function ReplyIcon({ color = '#0193ab' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Path d="M6 4L2 8L6 12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M2 8H10C12 8 14 9.5 14 12.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
function EditIcon({ color = '#0193ab' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Path d="M11 2L14 5L5 14H2V11L11 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </Svg>
  );
}
function CopyIcon({ color = '#0193ab' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Rect x="5" y="5" width="9" height="9" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <Path d="M2.5 10.5V3.5C2.5 2.95 2.95 2.5 3.5 2.5H10.5" stroke={color} strokeWidth="1.5"/>
    </Svg>
  );
}
function TrashIcon({ color = '#ef4444' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
      <Path d="M2.5 4.5H13.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <Path d="M6 4.5V2.5H10V4.5" stroke={color} strokeWidth="1.5"/>
      <Path d="M3.5 4.5L4.5 13.5C4.5 14 5 14.5 5.5 14.5H10.5C11 14.5 11.5 14 11.5 13.5L12.5 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </Svg>
  );
}
function PlusIcon({ color = '#64748b' }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M7 2.5V11.5M2.5 7H11.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </Svg>
  );
}
function PinIcon({ color = '#0193ab' }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 4h6l1 6-3 2v8l-1 1-1-1v-8L8 10z"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 10h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Path d="M12 4V2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function ActionRow({ icon, label, danger, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && { backgroundColor: 'rgba(0,0,0,0.05)' }]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <Text style={[styles.actionLabel, danger && { color: '#ef4444' }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * MessageActionsSheet — bottom-sheet modal opened by long-press.
 * Shows quick reactions + a list of contextual actions.
 *
 * Props:
 *   visible, onClose, message, fromMe, isPinned
 *   onReact(emoji), onReply(), onCopy(), onEdit(), onDelete("me"|"everyone"), onPin()
 */
export default function MessageActionsSheet({
  visible, onClose, message, fromMe, isPinned,
  onReact, onReply, onCopy, onEdit, onDelete, onPin,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!message) return null;

  const isText = message.type === 'text' || (!message.audioUrl && !message.type);
  const ageMs = Date.now() - new Date(message.time || 0).getTime();
  const canEdit         = fromMe && isText && ageMs < EDIT_MS && !message.deletedForEveryone;
  const canDeleteForAll = fromMe && ageMs < DEL_FOR_EVERYONE_MS && !message.deletedForEveryone;

  const handleReact = (emoji) => {
    Haptics.selectionAsync().catch(() => {});
    onReact?.(emoji);
    setPickerOpen(false);
    onClose?.();
  };

  const wrap = (fn) => () => {
    Haptics.selectionAsync().catch(() => {});
    fn?.();
    setPickerOpen(false);
    onClose?.();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {pickerOpen ? (
            <ScrollView contentContainerStyle={styles.pickerGrid}>
              {FULL_PICKER.map(e => (
                <Pressable key={e} onPress={() => handleReact(e)} style={styles.pickerCell}>
                  <Text style={styles.pickerEmoji}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <>
              <View style={styles.quickRow}>
                {QUICK_REACTIONS.map(e => (
                  <Pressable key={e} onPress={() => handleReact(e)} style={styles.quickCell}>
                    <Text style={styles.quickEmoji}>{e}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setPickerOpen(true)} style={[styles.quickCell, styles.quickCellMore]}>
                  <PlusIcon />
                </Pressable>
              </View>

              <View style={styles.divider} />

              <ActionRow icon={<ReplyIcon />} label="Reply" onPress={wrap(onReply)} />
              <ActionRow
                icon={<PinIcon color={isPinned ? '#f59e0b' : '#0193ab'} />}
                label={isPinned ? 'Unpin message' : 'Pin message'}
                onPress={wrap(onPin)}
              />
              {isText && (
                <ActionRow icon={<CopyIcon />} label="Copy text" onPress={wrap(onCopy)} />
              )}
              {canEdit && (
                <ActionRow icon={<EditIcon />} label="Edit" onPress={wrap(onEdit)} />
              )}
              <ActionRow icon={<TrashIcon color="#64748b" />} label="Delete for me" onPress={wrap(() => onDelete?.('me'))} />
              {canDeleteForAll && (
                <ActionRow icon={<TrashIcon />} label="Delete for everyone" danger onPress={wrap(() => onDelete?.('everyone'))} />
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 12,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
    paddingVertical: 6,
  },
  quickCell: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  quickCellMore: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  quickEmoji: { fontSize: 24 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 6,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  actionIcon: {
    width: 22, alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#0f172a',
  },

  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 8,
  },
  pickerCell: {
    width: '14%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerEmoji: { fontSize: 26 },
});
