import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TextInput, Modal, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme }   from '../../src/context/ThemeContext';
import PageHeader     from '../../src/components/shared/PageHeader';
import PageBackground from '../../src/components/shared/PageBackground';
import GlassCard      from '../../src/components/shared/GlassCard';
import AnimatedPressable from '../../src/components/shared/AnimatedPressable';
import Icon           from '../../src/components/shared/Icon';
import BrandButton    from '../../src/components/shared/BrandButton';
import ExpiryBanner   from '../../src/components/shared/ExpiryBanner';
import log            from '../../src/utils/logger';
import { spacing, typography, radius, glass, shadow, gradients } from '../../src/theme/colors';

const CATEGORIES = ['All', 'Bill of Lading', 'Rate Confirmation', 'Invoice', 'Insurance', 'Contract', 'Other'];
const CATEGORY_COLORS = {
  'Bill of Lading':    '#0193ab',
  'Rate Confirmation': '#10b981',
  'Invoice':           '#f59e0b',
  'Insurance':         '#ef4444',
  'Contract':          '#8b5cf6',
  'Other':             '#64748b',
};
const CATEGORY_ICONS = {
  'Bill of Lading':    'fileText',
  'Rate Confirmation': 'dollar',
  'Invoice':           'fileText',
  'Insurance':         'shield',
  'Contract':          'fileText',
  'Other':             'fileText',
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
  if (days < 0) return { text: 'Expired',   color: '#ef4444', days };
  if (days < 14) return { text: `${days}d left`, color: '#f59e0b', days };
  return { text: `${days}d left`, color: '#10b981', days };
}

// Filename pattern → category guess. Picks the first match.
const CATEGORY_PATTERNS = [
  { pattern: /(^|[_\-\s])(bol|bill[-_]?of[-_]?lading)([_\-\s\.]|$)/i, category: 'Bill of Lading' },
  { pattern: /(^|[_\-\s])(rc|rate[-_]?con(?:firmation)?)([_\-\s\.]|$)/i, category: 'Rate Confirmation' },
  { pattern: /(^|[_\-\s])(inv|invoice)([_\-\s\.]|$)/i, category: 'Invoice' },
  { pattern: /(^|[_\-\s])(ins|insurance|coi|certificate)([_\-\s\.]|$)/i, category: 'Insurance' },
  { pattern: /(^|[_\-\s])(contract|agreement|moa|moc|mlsa)([_\-\s\.]|$)/i, category: 'Contract' },
];

function guessCategory(filename = '') {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(filename)) return category;
  }
  return 'Other';
}

export default function DocumentsScreen() {
  const { colors, isDark } = useTheme();
  const glassFill   = isDark ? glass.fillDarkStrong : glass.fillLightStrong;
  const glassBorder = isDark ? glass.borderDark : glass.borderLightSoft;

  const [docs, setDocs]       = useState([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState('Newest');
  const [viewMode, setViewMode] = useState('grid');
  const [selected, setSelected] = useState(new Set());
  const [previewDoc, setPreviewDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [newName, setNewName] = useState('');
  const [showSort, setShowSort] = useState(false);

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
  const allDocs = [...pinnedDocs, ...regularDocs];

  // Expiry rollup (across all docs, not just filtered — banner is a global cue)
  const expiringSoon = useMemo(() => {
    let soon = 0; let expired = 0;
    for (const d of docs) {
      if (!d.expiry) continue;
      const days = Math.ceil((new Date(d.expiry) - Date.now()) / 86400000);
      if (days < 0) expired += 1;
      else if (days < 14) soon += 1;
    }
    return { soon, expired };
  }, [docs]);

  const togglePin = useCallback((id) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, pinned: !d.pinned } : d));
  }, []);

  const deleteDoc = useCallback((id) => {
    Alert.alert('Delete document', 'Are you sure?', [
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
          category: guessCategory(asset.name),
          size: asset.size || 0,
          addedAt: new Date().toISOString(),
          pinned: false,
        }));
        setDocs(prev => [...newDocs, ...prev]);
      }
    } catch (e) {
      log.error('DocumentsScreen', 'upload failed', e);
    }
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
    const catIcon    = CATEGORY_ICONS[doc.category] || 'fileText';

    if (viewMode === 'list') {
      return (
        <AnimatedPressable
          onPress={() => selected.size > 0 ? toggleSelect(doc.id) : setPreviewDoc(doc)}
          onLongPress={() => toggleSelect(doc.id)}
          pressedScale={0.99}
        >
          <View style={[
            s.listRow,
            { borderBottomColor: colors.borderSubtle },
            isSelected && { backgroundColor: colors.accentMuted },
          ]}>
            <AnimatedPressable onPress={() => toggleSelect(doc.id)} pressedScale={0.85}>
              <View style={[
                s.checkbox,
                { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' },
              ]}>
                {isSelected && <Icon name="checkmark" size={10} color="#fff" />}
              </View>
            </AnimatedPressable>
            <View style={[s.fileIcon, { backgroundColor: catColor + '1f' }]}>
              <Icon name={catIcon} size={18} color={catColor} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {doc.pinned && <Icon name="pin" size={11} color="#f59e0b" />}
                <Text style={[s.docName, { color: colors.textPrimary }]} numberOfLines={1}>{doc.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: 4, flexWrap: 'wrap' }}>
                <View style={[s.catBadge, { backgroundColor: catColor + '1f' }]}>
                  <Text style={[s.catBadgeText, { color: catColor }]}>{doc.category}</Text>
                </View>
                {expiry && (
                  <View style={[s.expiryBadge, { backgroundColor: expiry.color + '1f' }]}>
                    <Text style={[s.expiryText, { color: expiry.color }]}>{expiry.text}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.docSize, { color: colors.textMuted }]}>{formatSize(doc.size)}</Text>
              <Text style={[s.docDate, { color: colors.textDisabled }]}>{formatDate(doc.addedAt)}</Text>
            </View>
          </View>
        </AnimatedPressable>
      );
    }

    // grid card
    return (
      <View style={{ flex: 1, marginBottom: spacing[3] }}>
        <AnimatedPressable
          onPress={() => selected.size > 0 ? toggleSelect(doc.id) : setPreviewDoc(doc)}
          onLongPress={() => toggleSelect(doc.id)}
          pressedScale={0.97}
        >
          <GlassCard variant="strong" accent={isSelected} contentStyle={s.gridCard}>
            {doc.pinned && (
              <View style={s.pinIcon}>
                <Icon name="pin" size={12} color="#f59e0b" />
              </View>
            )}
            <AnimatedPressable onPress={() => toggleSelect(doc.id)} pressedScale={0.85}>
              <View style={[
                s.gridCheckbox,
                { borderColor: isSelected ? colors.accent : colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' },
              ]}>
                {isSelected && <Icon name="checkmark" size={10} color="#fff" />}
              </View>
            </AnimatedPressable>
            <View style={[s.gridThumb, { backgroundColor: catColor + '14', borderColor: catColor + '24' }]}>
              {/* Folded corner */}
              <View style={[s.gridCorner, { borderTopColor: catColor + '44' }]} />
              {/* Mock page lines */}
              <View style={s.gridLines} pointerEvents="none">
                <View style={[s.gridLine, { width: '88%', backgroundColor: catColor + '55' }]} />
                <View style={[s.gridLine, { width: '62%', backgroundColor: catColor + '33' }]} />
                <View style={[s.gridLine, { width: '76%', backgroundColor: catColor + '33' }]} />
                <View style={[s.gridLine, { width: '40%', backgroundColor: catColor + '33' }]} />
              </View>
              <View style={s.gridIconCenter}>
                <Icon name={catIcon} size={22} color={catColor} />
              </View>
              <View style={[s.gridCatBadge, { backgroundColor: catColor }]}>
                <Text style={s.gridCatText}>{doc.category.split(' ')[0].toUpperCase()}</Text>
              </View>
            </View>
            {doc.loadId ? (
              <View style={[s.linkedLoadChip, { backgroundColor: colors.accentMuted, borderColor: 'rgba(1,147,171,0.32)' }]}>
                <Icon name="navigation" size={9} color={colors.accent} />
                <Text style={[s.linkedLoadText, { color: colors.accent }]} numberOfLines={1}>{doc.loadId}</Text>
              </View>
            ) : null}
            <Text style={[s.gridDocName, { color: colors.textPrimary }]} numberOfLines={2}>{doc.name}</Text>
            {doc.note && <Text style={[s.gridNote, { color: colors.textMuted }]} numberOfLines={1}>{doc.note}</Text>}
            {expiry && (
              <View style={[s.expiryBadge, { backgroundColor: expiry.color + '1f', alignSelf: 'flex-start', marginTop: 4 }]}>
                <Text style={[s.expiryText, { color: expiry.color }]}>{expiry.text}</Text>
              </View>
            )}
            <View style={s.gridFooter}>
              <Text style={[s.docSize, { color: colors.textMuted }]}>{formatSize(doc.size)}</Text>
              <View style={s.gridDocActions}>
                <AnimatedPressable onPress={() => togglePin(doc.id)} hapticStyle="light" pressedScale={0.85}>
                  <Icon name="pin" size={14} color={doc.pinned ? '#f59e0b' : colors.textDisabled} />
                </AnimatedPressable>
                <AnimatedPressable onPress={() => deleteDoc(doc.id)} hapticStyle="warning" pressedScale={0.85}>
                  <Icon name="close" size={14} color={colors.dangerText} />
                </AnimatedPressable>
              </View>
            </View>
          </GlassCard>
        </AnimatedPressable>
      </View>
    );
  }, [selected, colors, viewMode]);

  return (
    <PageBackground>
      <SafeAreaView style={s.safe} edges={['left', 'right']}>
        <PageHeader title="Documents" subtitle={`${filtered.length} of ${docs.length} files`} />

        <ExpiryBanner
          count={expiringSoon.soon}
          expired={expiringSoon.expired}
          noun="document"
          onPress={() => {
            // Switch to whichever category has the most expiring items, or All.
            setCategory('Insurance');
            setSort('Newest');
          }}
        />

        <View style={s.controlsWrap}>
          <View style={s.searchRow}>
            <View style={[s.searchBox, { backgroundColor: glassFill, borderColor: glassBorder }]}>
              <Icon name="search" size={15} color={colors.textDisabled} />
              <TextInput
                style={[s.searchInput, { color: colors.textPrimary }]}
                placeholder="Search documents…"
                placeholderTextColor={colors.textDisabled}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <AnimatedPressable onPress={() => setSearch('')} pressedScale={0.85}>
                  <Icon name="close" size={14} color={colors.textMuted} />
                </AnimatedPressable>
              )}
            </View>
            <AnimatedPressable
              onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              hapticStyle="selection"
              pressedScale={0.92}
            >
              <View style={[s.iconBtn, { backgroundColor: glassFill, borderColor: glassBorder }]}>
                <Icon name={viewMode === 'grid' ? 'list' : 'options'} size={16} color={colors.textMuted} />
              </View>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => setShowSort(v => !v)}
              hapticStyle="selection"
              pressedScale={0.92}
            >
              <View style={[
                s.iconBtn,
                {
                  backgroundColor: showSort ? colors.accentMuted : glassFill,
                  borderColor: showSort ? colors.accent : glassBorder,
                },
              ]}>
                <Icon name="filter" size={15} color={showSort ? colors.accent : colors.textMuted} />
              </View>
            </AnimatedPressable>
            <BrandButton label="Add" icon="upload" size="sm" onPress={handleUpload} />
          </View>

          {showSort && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.sortScroll}
              contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[4] }}
            >
              {SORTS.map(s2 => (
                <AnimatedPressable
                  key={s2}
                  onPress={() => { setSort(s2); setShowSort(false); }}
                  hapticStyle="selection"
                  pressedScale={0.94}
                >
                  <View style={[s.sortChip, {
                    backgroundColor: sort === s2 ? colors.accentMuted : glassFill,
                    borderColor: sort === s2 ? colors.accent : glassBorder,
                  }]}>
                    <Text style={[s.sortChipText, { color: sort === s2 ? colors.accent : colors.textMuted }]}>{s2}</Text>
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          )}

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.catScroll}
            contentContainerStyle={s.catContent}
          >
            {CATEGORIES.map(cat => {
              const count = cat === 'All' ? docs.length : docs.filter(d => d.category === cat).length;
              const color = CATEGORY_COLORS[cat] || colors.accent;
              const active = category === cat;
              return (
                <AnimatedPressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  hapticStyle="selection"
                  pressedScale={0.94}
                >
                  <View style={[s.catTab, {
                    borderColor: active ? color : glassBorder,
                    backgroundColor: active ? color + '1f' : glassFill,
                  }]}>
                    {cat !== 'All' && <View style={[s.catDot, { backgroundColor: color }]} />}
                    <Text style={[s.catTabText, { color: active ? color : colors.textMuted }]}>{cat}</Text>
                    <Text style={[s.catCount, { color: active ? color : colors.textDisabled }]}>{count}</Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </View>

        <FlatList
          key={viewMode}
          data={allDocs}
          keyExtractor={d => d.id}
          renderItem={renderDoc}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? s.gridRow : undefined}
          contentContainerStyle={[viewMode === 'grid' ? s.gridContent : {}, { paddingBottom: 100 }]}
          removeClippedSubviews
          initialNumToRender={viewMode === 'grid' ? 10 : 12}
          maxToRenderPerBatch={12}
          windowSize={7}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIconWrap, { backgroundColor: 'rgba(1,147,171,0.12)' }]}>
                <Icon name="folder" size={42} color="#0193ab" />
              </View>
              <Text style={[s.emptyText, { color: colors.textPrimary }]}>No documents yet</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>Add BOLs, rate cons, invoices — keep them at hand.</Text>
              <View style={{ marginTop: spacing[5] }}>
                <BrandButton
                  label="Upload document"
                  icon="upload"
                  size="md"
                  onPress={handleUpload}
                />
              </View>
            </View>
          }
        />

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <View style={[s.bulkBar, { backgroundColor: colors.elevated, borderTopColor: colors.border }]}>
            <Text style={[s.bulkCount, { color: colors.textPrimary }]}>{selected.size} selected</Text>
            <View style={s.bulkActions}>
              <AnimatedPressable hapticStyle="light" pressedScale={0.96}>
                <View style={[s.bulkBtn, { backgroundColor: colors.accentMuted }]}>
                  <Icon name="upload" size={13} color={colors.accent} />
                  <Text style={[s.bulkBtnText, { color: colors.accent }]}>Send</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => {
                  Alert.alert('Delete', `Delete ${selected.size} documents?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => {
                      setDocs(prev => prev.filter(d => !selected.has(d.id)));
                      setSelected(new Set());
                    } },
                  ]);
                }}
                hapticStyle="warning"
                pressedScale={0.96}
              >
                <View style={[s.bulkBtn, { backgroundColor: colors.dangerBg }]}>
                  <Icon name="close" size={13} color={colors.dangerText} />
                  <Text style={[s.bulkBtnText, { color: colors.dangerText }]}>Delete</Text>
                </View>
              </AnimatedPressable>
            </View>
            <AnimatedPressable onPress={() => setSelected(new Set())} pressedScale={0.85}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          </View>
        )}

        {/* Preview Modal */}
        {previewDoc && (
          <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPreviewDoc(null)}>
            <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.previewHeader}
              >
                <SafeAreaView edges={['top']} style={{ width: '100%' }}>
                  <View style={s.previewHeaderInner}>
                    <AnimatedPressable
                      onPress={() => setPreviewDoc(null)}
                      hapticStyle="light"
                      pressedScale={0.9}
                    >
                      <View style={s.previewIconBtn}>
                        <Icon name="arrowLeft" size={18} color="#fff" />
                      </View>
                    </AnimatedPressable>
                    <Text style={s.previewTitle} numberOfLines={1}>
                      {previewDoc.name}
                    </Text>
                    <AnimatedPressable
                      onPress={() => { setRenameDoc(previewDoc); setNewName(previewDoc.name); setPreviewDoc(null); }}
                      hapticStyle="light"
                      pressedScale={0.9}
                    >
                      <View style={s.previewIconBtn}>
                        <Icon name="pencil" size={16} color="#fff" />
                      </View>
                    </AnimatedPressable>
                  </View>
                </SafeAreaView>
              </LinearGradient>
              <View style={s.previewBody}>
                <View style={[s.previewIconWrap, { backgroundColor: (CATEGORY_COLORS[previewDoc.category] || colors.accent) + '1c' }]}>
                  <Icon
                    name={CATEGORY_ICONS[previewDoc.category] || 'fileText'}
                    size={56}
                    color={CATEGORY_COLORS[previewDoc.category] || colors.accent}
                  />
                </View>
                <Text style={[s.previewFileName, { color: colors.textPrimary }]}>{previewDoc.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], justifyContent: 'center', marginTop: spacing[3] }}>
                  <View style={[s.catBadge, { backgroundColor: (CATEGORY_COLORS[previewDoc.category] || colors.accent) + '1f' }]}>
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
                  PDF preview opens in your default viewer
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[3], marginTop: spacing[5], width: '100%' }}>
                  <View style={{ flex: 1 }}>
                    <BrandButton label="Download" icon="download" full size="md" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <BrandButton
                      label={previewDoc.pinned ? 'Unpin' : 'Pin'}
                      icon="pin"
                      variant="secondary"
                      full size="md"
                      onPress={() => togglePin(previewDoc.id)}
                    />
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Rename Modal */}
        {renameDoc && (
          <Modal visible animationType="fade" transparent onRequestClose={() => setRenameDoc(null)}>
            <View style={s.renameOverlay}>
              <GlassCard variant="floating" accent contentStyle={s.renameModal}>
                <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Rename document</Text>
                <Text style={[s.modalSub, { color: colors.textMuted }]}>Extension preserved automatically</Text>
                <TextInput
                  style={[s.renameInput, { backgroundColor: colors.surface2, borderColor: colors.border, color: colors.textPrimary }]}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] }}>
                  <AnimatedPressable onPress={() => setRenameDoc(null)} pressedScale={0.97} hapticStyle="light">
                    <View style={[s.outlineBtn, { borderColor: colors.border }]}>
                      <Text style={[s.outlineBtnText, { color: colors.textMuted }]}>Cancel</Text>
                    </View>
                  </AnimatedPressable>
                  <View style={{ flex: 1 }}>
                    <BrandButton label="Save" full size="md" onPress={handleRename} />
                  </View>
                </View>
              </GlassCard>
            </View>
          </Modal>
        )}
      </SafeAreaView>
    </PageBackground>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  controlsWrap: { paddingTop: spacing[3] },
  searchRow: { flexDirection: 'row', paddingHorizontal: spacing[4], gap: spacing[2], alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.md, paddingHorizontal: spacing[3], borderWidth: 1, gap: spacing[2],
  },
  searchInput: { flex: 1, fontSize: typography.sm, paddingVertical: 10, fontWeight: '500' },
  iconBtn: { width: 38, height: 38, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },

  sortScroll: { flexGrow: 0, paddingVertical: spacing[2] },
  sortChip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  sortChipText: { fontSize: typography.xs, fontWeight: '700' },

  catScroll: { flexGrow: 0 },
  catContent: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], gap: spacing[2] },
  catTab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, gap: 5,
  },
  catDot: { width: 6, height: 6, borderRadius: 99 },
  catTabText: { fontSize: typography.xs, fontWeight: '700' },
  catCount: { fontSize: 10, fontWeight: '800' },

  gridRow: { paddingHorizontal: spacing[4], gap: spacing[3] },
  gridContent: { paddingTop: spacing[3] },
  gridCard: { padding: spacing[3], position: 'relative' },
  pinIcon: { position: 'absolute', top: spacing[2], left: spacing[2], zIndex: 2 },
  gridCheckbox: {
    position: 'absolute', top: spacing[2], right: spacing[2],
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  gridThumb: {
    height: 102, borderRadius: radius.md,
    marginBottom: spacing[2], position: 'relative',
    borderWidth: 1, overflow: 'hidden',
    padding: 8,
  },
  gridCorner: {
    position: 'absolute', top: 0, right: 0,
    width: 0, height: 0,
    borderTopWidth: 14, borderRightWidth: 14,
    borderRightColor: 'transparent',
  },
  gridLines: { position: 'absolute', top: 12, left: 8, right: 8, gap: 4 },
  gridLine: { height: 3, borderRadius: 2 },
  gridIconCenter: {
    position: 'absolute', bottom: 22, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  gridCatBadge: { position: 'absolute', bottom: 4, right: 4, borderRadius: radius.xs, paddingHorizontal: 5, paddingVertical: 2 },
  gridCatText: { color: '#fff', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.3 },
  linkedLoadChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: spacing[1],
  },
  linkedLoadText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2 },
  gridDocName: { fontSize: 12, fontWeight: '700', marginBottom: 2, lineHeight: 16 },
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
  docName: { fontSize: 13.5, fontWeight: '700', letterSpacing: -0.1 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  catBadgeText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2 },
  expiryBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  expiryText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.2 },
  docSize: { fontSize: 11, fontWeight: '600' },
  docDate: { fontSize: 11, marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: spacing[6] },
  emptyIconWrap: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] },
  emptyText: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  emptySub: { fontSize: typography.sm, marginTop: 6, textAlign: 'center' },

  bulkBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[4], borderTopWidth: 1, gap: spacing[3],
  },
  bulkCount: { fontSize: typography.sm, fontWeight: '800' },
  bulkActions: { flex: 1, flexDirection: 'row', gap: spacing[2] },
  bulkBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  bulkBtnText: { fontSize: typography.xs, fontWeight: '800' },

  previewHeader: { overflow: 'hidden' },
  previewHeaderInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[3], gap: spacing[2],
  },
  previewIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewTitle: { flex: 1, color: '#fff', fontSize: typography.sm, fontWeight: '800', textAlign: 'center', letterSpacing: -0.1 },
  previewBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  previewIconWrap: { width: 104, height: 104, borderRadius: 52, justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4] },
  previewFileName: { fontSize: typography.base, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 },
  previewNote: { fontSize: typography.xs, textAlign: 'center', marginTop: spacing[4], fontStyle: 'italic' },

  renameOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[5] },
  renameModal: { padding: spacing[5] },
  renameInput: { borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderWidth: 1, fontSize: typography.base, marginTop: spacing[4], fontWeight: '500' },
  modalTitle: { fontSize: typography.lg, fontWeight: '800', letterSpacing: -0.3 },
  modalSub: { fontSize: typography.sm, marginTop: 4 },
  outlineBtn: { borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  outlineBtnText: { fontSize: typography.sm, fontWeight: '700' },
});
