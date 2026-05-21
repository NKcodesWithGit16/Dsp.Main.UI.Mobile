import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import PageHeader from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import { spacing, typography, radius, glass, shadow } from '../../src/theme/colors';

const CATEGORIES = ['All', 'Bill of Lading', 'Rate Confirmation', 'Invoice', 'Insurance', 'Contract', 'Other'];
const CATEGORY_COLORS = {
  'Bill of Lading':    '#6366f1',
  'Rate Confirmation': '#10b981',
  'Invoice':           '#f59e0b',
  'Insurance':         '#ef4444',
  'Contract':          '#8b5cf6',
  'Other':             '#6b7280',
};
const CATEGORY_ICONS = {
  'Bill of Lading':    'document-text',
  'Rate Confirmation': 'cash',
  'Invoice':           'receipt',
  'Insurance':         'shield-checkmark',
  'Contract':          'reader',
  'Other':             'document',
};
const SORTS = ['Newest', 'Oldest', 'Name A-Z', 'Name Z-A', 'Largest', 'Smallest'];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function expiryLabel(iso) {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  if (days < 0) return { text: 'Expired',   color: '#ef4444' };
  if (days < 14) return { text: `${days}d left`, color: '#f59e0b' };
  return { text: `${days}d left`, color: '#10b981' };
}

export default function DocumentsScreen() {
  const { colors, isDark } = useTheme();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;
  const [docs, setDocs]           = useState([]);
  const [category, setCategory]   = useState('All');
  const [search, setSearch]       = useState('');
  const [sort, setSort]           = useState('Newest');
  const [viewMode, setViewMode]   = useState('grid');
  const [selected, setSelected]   = useState(new Set());
  const [previewDoc, setPreviewDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [newName, setNewName]     = useState('');
  const [showSort, setShowSort]   = useState(false);

  const filtered = useMemo(() => {
    let result = docs;
    if (category !== 'All') result = result.filter(d => d.category === category);
    if (search) result = result.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
    switch (sort) {
      case 'Oldest':   result = [...result].sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt)); break;
      case 'Name A-Z': result = [...result].sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'Name Z-A': result = [...result].sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'Largest':  result = [...result].sort((a, b) => b.size - a.size); break;
      case 'Smallest': result = [...result].sort((a, b) => a.size - b.size); break;
      default:         result = [...result].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    }
    return result;
  }, [docs, category, search, sort]);

  const pinnedDocs  = filtered.filter(d => d.pinned);
  const regularDocs = filtered.filter(d => !d.pinned);

  const togglePin = useCallback((id) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, pinned: !d.pinned } : d));
  }, []);

  const deleteDoc = useCallback((id) => {
    Alert.alert('Delete Document', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setDocs(prev => prev.filter(d => d.id !== id)) },
    ]);
  }, []);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled && result.assets) {
        const newDocs = result.assets.map((asset, i) => ({
          id: `upload-${Date.now()}-${i}`,
          name: asset.name,
          category: 'Other',
          size: asset.size || 0,
          addedAt: new Date().toISOString(),
          pinned: false,
        }));
        setDocs(prev => [...newDocs, ...prev]);
        Alert.alert('Uploaded', `${newDocs.length} file(s) added`);
      }
    } catch (_) {}
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRename = () => {
    if (newName.trim()) {
      setDocs(prev => prev.map(d => d.id === renameDoc.id ? { ...d, name: newName.trim() } : d));
      setRenameDoc(null);
    }
  };

  const s = makeStyles(colors);

  const renderDoc = useCallback(({ item: doc }) => {
    const isSelected = selected.has(doc.id);
    const expiry     = expiryLabel(doc.expiry);
    const catColor   = CATEGORY_COLORS[doc.category] || colors.textMuted;
    const catIcon    = CATEGORY_ICONS[doc.category] || 'document';

    if (viewMode === 'list') {
      return (
        <TouchableOpacity
          style={[s.listRow, { borderBottomColor: colors.borderSubtle }, isSelected && { backgroundColor: colors.accentMuted }]}
          onPress={() => selected.size > 0 ? toggleSelect(doc.id) : setPreviewDoc(doc)}
          onLongPress={() => toggleSelect(doc.id)}
        >
          <TouchableOpacity
            onPress={() => toggleSelect(doc.id)}
            style={[s.checkbox, { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' }]}
          >
            {isSelected && <Ionicons name="checkmark" size={10} color="#fff" />}
          </TouchableOpacity>
          <View style={[s.fileIcon, { backgroundColor: catColor + '1a' }]}>
            <Ionicons name={catIcon} size={18} color={catColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {doc.pinned && <Ionicons name="bookmark" size={11} color={colors.warning} />}
              <Text style={[s.docName, { color: colors.textPrimary }]} numberOfLines={1}>{doc.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: 2, flexWrap: 'wrap' }}>
              <View style={[s.catBadge, { backgroundColor: catColor + '1a' }]}>
                <Text style={[s.catBadgeText, { color: catColor }]}>{doc.category}</Text>
              </View>
              {expiry && (
                <View style={[s.expiryBadge, { backgroundColor: expiry.color + '1a' }]}>
                  <Text style={[s.expiryText, { color: expiry.color }]}>{expiry.text}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[s.docSize, { color: colors.textMuted }]}>{formatSize(doc.size)}</Text>
            <Text style={[s.docDate, { color: colors.textDisabled }]}>{formatDate(doc.addedAt)}</Text>
          </View>
          <View style={s.docActions}>
            <TouchableOpacity onPress={() => togglePin(doc.id)} style={s.docAction}>
              <Ionicons name={doc.pinned ? 'bookmark' : 'bookmark-outline'} size={15} color={doc.pinned ? colors.warning : colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setRenameDoc(doc); setNewName(doc.name); }} style={s.docAction}>
              <Ionicons name="pencil-outline" size={15} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={s.docAction}>
              <Ionicons name="trash-outline" size={15} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[s.gridCard, { backgroundColor: glassFill, borderColor: isSelected ? colors.accent : glassBorder }]}
        onPress={() => selected.size > 0 ? toggleSelect(doc.id) : setPreviewDoc(doc)}
        onLongPress={() => toggleSelect(doc.id)}
        activeOpacity={0.8}
      >
        {doc.pinned && (
          <View style={s.pinIcon}>
            <Ionicons name="bookmark" size={12} color={colors.warning} />
          </View>
        )}
        <TouchableOpacity
          style={[s.gridCheckbox, { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' }]}
          onPress={() => toggleSelect(doc.id)}
        >
          {isSelected && <Ionicons name="checkmark" size={10} color="#fff" />}
        </TouchableOpacity>
        <View style={[s.gridThumb, { backgroundColor: catColor + '12' }]}>
          <Ionicons name={catIcon} size={30} color={catColor} />
          <View style={[s.gridCatBadge, { backgroundColor: catColor }]}>
            <Text style={s.gridCatText}>{doc.category.split(' ')[0]}</Text>
          </View>
        </View>
        <Text style={[s.gridDocName, { color: colors.textPrimary }]} numberOfLines={2}>{doc.name}</Text>
        {doc.note && <Text style={[s.gridNote, { color: colors.textMuted }]} numberOfLines={1}>{doc.note}</Text>}
        {expiry && (
          <View style={[s.expiryBadge, { backgroundColor: expiry.color + '1a', alignSelf: 'flex-start', marginTop: 4 }]}>
            <Text style={[s.expiryText, { color: expiry.color }]}>{expiry.text}</Text>
          </View>
        )}
        <View style={s.gridFooter}>
          <Text style={[s.docSize, { color: colors.textMuted }]}>{formatSize(doc.size)}</Text>
          <View style={s.gridDocActions}>
            <TouchableOpacity onPress={() => togglePin(doc.id)}>
              <Ionicons name={doc.pinned ? 'bookmark' : 'bookmark-outline'} size={14} color={doc.pinned ? colors.warning : colors.textDisabled} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteDoc(doc.id)}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selected, colors, viewMode]);

  const allDocs = [...pinnedDocs, ...regularDocs];

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader title="Documents" subtitle={`${filtered.length} of ${docs.length} files`} />

        {/* Controls */}
        <View style={s.controlsWrap}>
          <View style={s.searchRow}>
            <View style={[s.searchBox, { backgroundColor: glassFill, borderColor: glassBorder }]}>
              <Ionicons name="search-outline" size={15} color={colors.textDisabled} />
              <TextInput
                style={[s.searchInput, { color: colors.textPrimary }]}
                placeholder="Search documents…"
                placeholderTextColor={colors.textDisabled}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: glassFill, borderColor: glassBorder }]}
              onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            >
              <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={17} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: showSort ? colors.accentMuted : glassFill, borderColor: showSort ? colors.accent : glassBorder }]}
              onPress={() => setShowSort(v => !v)}
            >
              <Ionicons name="funnel-outline" size={15} color={showSort ? colors.accent : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.uploadBtn, { backgroundColor: colors.accentDark, ...shadow.glow }]} onPress={handleUpload}>
              <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
              <Text style={s.uploadBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {showSort && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.sortScroll}
              contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}
            >
              {SORTS.map(s2 => (
                <TouchableOpacity
                  key={s2}
                  style={[s.sortChip, {
                    backgroundColor: sort === s2 ? colors.accentMuted : glassFill,
                    borderColor: sort === s2 ? colors.accent : glassBorder,
                  }]}
                  onPress={() => { setSort(s2); setShowSort(false); }}
                >
                  <Text style={[s.sortChipText, { color: sort === s2 ? colors.accent : colors.textMuted }]}>{s2}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.catScroll}
            contentContainerStyle={s.catContent}
          >
            {CATEGORIES.map(cat => {
              const count = cat === 'All' ? docs.length : docs.filter(d => d.category === cat).length;
              const color = CATEGORY_COLORS[cat] || colors.accent;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[s.catTab, {
                    borderColor: category === cat ? color : glassBorder,
                    backgroundColor: category === cat ? color + '18' : glassFill,
                  }]}
                  onPress={() => setCategory(cat)}
                >
                  {cat !== 'All' && <View style={[s.catDot, { backgroundColor: color }]} />}
                  <Text style={[s.catTabText, { color: category === cat ? color : colors.textMuted }]}>{cat}</Text>
                  <Text style={[s.catCount, { color: category === cat ? color : colors.textDisabled }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Doc List */}
        <FlatList
          key={viewMode}
          data={allDocs}
          keyExtractor={d => d.id}
          renderItem={renderDoc}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? s.gridRow : undefined}
          contentContainerStyle={[viewMode === 'grid' ? s.gridContent : {}, { paddingBottom: 80 }]}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIconWrap, { backgroundColor: colors.surface2 }]}>
                <Ionicons name="folder-open-outline" size={40} color={colors.textDisabled} />
              </View>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>No documents found</Text>
              <TouchableOpacity
                style={[s.uploadBtn, { backgroundColor: colors.accentDark, marginTop: spacing[4], paddingHorizontal: spacing[5], flexDirection: 'row', gap: 6 }]}
                onPress={handleUpload}
              >
                <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                <Text style={s.uploadBtnText}>Upload Document</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Bulk Actions Bar */}
        {selected.size > 0 && (
          <View style={[s.bulkBar, { backgroundColor: colors.elevated, borderTopColor: colors.border }]}>
            <Text style={[s.bulkCount, { color: colors.textPrimary }]}>{selected.size} selected</Text>
            <View style={s.bulkActions}>
              <TouchableOpacity style={[s.bulkBtn, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="share-outline" size={13} color={colors.accent} />
                <Text style={[s.bulkBtnText, { color: colors.accent }]}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bulkBtn, { backgroundColor: colors.dangerBg }]}
                onPress={() => {
                  Alert.alert('Delete', `Delete ${selected.size} documents?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => { setDocs(prev => prev.filter(d => !selected.has(d.id))); setSelected(new Set()); } },
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={13} color={colors.danger} />
                <Text style={[s.bulkBtnText, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setSelected(new Set())}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Preview Modal */}
        {previewDoc && (
          <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPreviewDoc(null)}>
            <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
              <View style={[s.previewHeader, { backgroundColor: colors.surface1, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setPreviewDoc(null)}>
                  <Ionicons name="chevron-back" size={22} color={colors.accent} />
                </TouchableOpacity>
                <Text style={[s.previewTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {previewDoc.name}
                </Text>
                <TouchableOpacity onPress={() => { setRenameDoc(previewDoc); setNewName(previewDoc.name); setPreviewDoc(null); }}>
                  <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                </TouchableOpacity>
              </View>
              <View style={s.previewBody}>
                <View style={[s.previewIconWrap, { backgroundColor: (CATEGORY_COLORS[previewDoc.category] || colors.accent) + '18' }]}>
                  <Ionicons
                    name={CATEGORY_ICONS[previewDoc.category] || 'document'}
                    size={52}
                    color={CATEGORY_COLORS[previewDoc.category] || colors.accent}
                  />
                </View>
                <Text style={[s.previewFileName, { color: colors.textPrimary }]}>{previewDoc.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[3] }}>
                  <View style={[s.catBadge, { backgroundColor: (CATEGORY_COLORS[previewDoc.category] || colors.accent) + '1a' }]}>
                    <Text style={[s.catBadgeText, { color: CATEGORY_COLORS[previewDoc.category] || colors.accent }]}>
                      {previewDoc.category}
                    </Text>
                  </View>
                  <Text style={[s.docSize, { color: colors.textMuted }]}>{formatSize(previewDoc.size)}</Text>
                  <Text style={[s.docDate, { color: colors.textDisabled }]}>{formatDate(previewDoc.addedAt)}</Text>
                </View>
                {previewDoc.loadId && (
                  <Text style={[s.docDate, { color: colors.textMuted, marginTop: spacing[2] }]}>
                    Linked to load: {previewDoc.loadId}
                  </Text>
                )}
                {previewDoc.note && (
                  <Text style={[s.docDate, { color: colors.textMuted, marginTop: spacing[1] }]}>{previewDoc.note}</Text>
                )}
                <Text style={[s.previewNote, { color: colors.textMuted }]}>
                  PDF preview requires a native PDF viewer plugin
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[5] }}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.accentDark, flex: 1 }]}>
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={s.actionBtnText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.surface2, flex: 1 }]}
                    onPress={() => togglePin(previewDoc.id)}
                  >
                    <Ionicons name={previewDoc.pinned ? 'bookmark' : 'bookmark-outline'} size={16} color={colors.textPrimary} />
                    <Text style={[s.actionBtnText, { color: colors.textPrimary }]}>
                      {previewDoc.pinned ? 'Unpin' : 'Pin'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Rename Modal */}
        {renameDoc && (
          <Modal visible animationType="fade" transparent onRequestClose={() => setRenameDoc(null)}>
            <View style={s.renameOverlay}>
              <View style={[s.renameModal, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Rename Document</Text>
                <Text style={[s.modalSub, { color: colors.textMuted }]}>Extension preserved automatically</Text>
                <TextInput
                  style={[s.renameInput, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary }]}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
                  <TouchableOpacity style={[s.outlineBtn, { borderColor: colors.border, flex: 1 }]} onPress={() => setRenameDoc(null)}>
                    <Text style={[s.outlineBtnText, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.accentDark, flex: 1 }]} onPress={handleRename}>
                    <Text style={s.actionBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </PageBackground>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  controlsWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingTop: spacing[3] },
  searchRow: { flexDirection: 'row', padding: spacing[3], gap: spacing[2], alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1, gap: spacing[2],
  },
  searchInput: { flex: 1, fontSize: typography.sm, paddingVertical: spacing[2] },
  iconBtn: { width: 38, height: 38, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  uploadBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  uploadBtnText: { color: '#fff', fontSize: typography.sm, fontWeight: '700' },

  sortScroll: { flexGrow: 0, paddingVertical: spacing[2] },
  sortChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.pill, borderWidth: 1 },
  sortChipText: { fontSize: typography.xs, fontWeight: '600' },

  catScroll: { flexGrow: 0 },
  catContent: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[2] },
  catTab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.pill, borderWidth: 1, gap: 5,
  },
  catDot: { width: 6, height: 6, borderRadius: 99 },
  catTabText: { fontSize: typography.xs, fontWeight: '600' },
  catCount: { fontSize: 10, fontWeight: '700' },

  gridRow: { paddingHorizontal: spacing[3], gap: spacing[3] },
  gridContent: { paddingTop: spacing[3] },
  gridCard: { flex: 1, borderRadius: radius.xl, borderWidth: 1, padding: spacing[3], marginBottom: spacing[3], position: 'relative', ...shadow.card },
  pinIcon: { position: 'absolute', top: spacing[2], left: spacing[2] },
  gridCheckbox: { position: 'absolute', top: spacing[2], right: spacing[2], width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  gridThumb: { height: 80, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[2], position: 'relative' },
  gridCatBadge: { position: 'absolute', bottom: 4, right: 4, borderRadius: radius.xs, paddingHorizontal: 4, paddingVertical: 1 },
  gridCatText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  gridDocName: { fontSize: typography.xs, fontWeight: '600', marginBottom: 2, lineHeight: 16 },
  gridNote: { fontSize: 10, marginBottom: 2 },
  gridFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[1] },
  gridDocActions: { flexDirection: 'row', gap: spacing[2] },

  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing[2],
  },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  fileIcon: { width: 38, height: 38, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  docName: { fontSize: typography.sm, fontWeight: '600', letterSpacing: -0.1 },
  catBadge: { paddingHorizontal: spacing[2], paddingVertical: 1, borderRadius: radius.pill, alignSelf: 'flex-start' },
  catBadgeText: { fontSize: 10, fontWeight: '600' },
  expiryBadge: { paddingHorizontal: spacing[2], paddingVertical: 1, borderRadius: radius.pill },
  expiryText: { fontSize: 10, fontWeight: '700' },
  docSize: { fontSize: 10 },
  docDate: { fontSize: 10, marginTop: 2 },
  docActions: { flexDirection: 'row', gap: spacing[1] },
  docAction: { padding: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] },
  emptyText: { fontSize: typography.base },

  bulkBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[4], borderTopWidth: 1, gap: spacing[3],
  },
  bulkCount: { fontSize: typography.sm, fontWeight: '700' },
  bulkActions: { flex: 1, flexDirection: 'row', gap: spacing[2] },
  bulkBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  bulkBtnText: { fontSize: typography.xs, fontWeight: '700' },

  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 56,
  },
  previewTitle: { flex: 1, fontSize: typography.sm, fontWeight: '600', textAlign: 'center', marginHorizontal: spacing[2] },
  previewBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  previewIconWrap: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] },
  previewFileName: { fontSize: typography.base, fontWeight: '700', textAlign: 'center', letterSpacing: -0.1 },
  previewNote: { fontSize: typography.xs, textAlign: 'center', marginTop: spacing[4], fontStyle: 'italic' },

  actionBtn: {
    borderRadius: radius.lg, paddingVertical: spacing[4],
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 7,
  },
  actionBtnText: { color: '#fff', fontSize: typography.base, fontWeight: '700' },

  renameOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[5] },
  renameModal: { borderRadius: radius['2xl'], padding: spacing[5], borderWidth: 1 },
  renameInput: { borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderWidth: 1, fontSize: typography.base, marginTop: spacing[4] },
  modalTitle: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  modalSub: { fontSize: typography.sm, marginTop: 4 },
  outlineBtn: { borderRadius: radius.lg, paddingVertical: spacing[4], alignItems: 'center', borderWidth: 1 },
  outlineBtnText: { fontSize: typography.base, fontWeight: '600' },
});
