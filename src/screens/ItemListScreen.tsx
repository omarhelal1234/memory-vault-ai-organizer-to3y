import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  listMemories,
  processMyMemories,
  itemsIn,
  unprocessed,
  categoryIcon,
  primaryCategory,
  subcategoryOf,
  setDone,
  PRIORITY_META,
} from '../lib/api';
import type { Memory } from '../types';

const TYPE_ICON: Record<string, string> = {
  note: '📝',
  link: '🔗',
  screenshot: '🖼️',
  photo: '📷',
  voice_memo: '🎙️',
  video: '🎬',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  processing: { bg: '#DBEAFE', fg: '#1E40AF', label: 'Processing' },
  completed: { bg: '#D1FAE5', fg: '#065F46', label: 'Done' },
  failed: { bg: '#FEE2E2', fg: '#991B1B', label: 'Failed' },
};

const Chip = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <View style={[styles.chip, { backgroundColor: bg }]}>
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);

const ItemRow = ({
  memory,
  inbox,
  onPress,
  onToggleDone,
}: {
  memory: Memory;
  inbox: boolean;
  onPress: () => void;
  onToggleDone: () => void;
}) => {
  const category = primaryCategory(memory);
  const summary = memory.ai_metadata?.summary;
  const icon = inbox ? TYPE_ICON[memory.type] ?? '📦' : categoryIcon(category);
  const titleText =
    memory.title || summary || memory.content_text || memory.url || 'Untitled';
  const kind = memory.structured_data?.kind;
  const prio = memory.priority ? PRIORITY_META[memory.priority] : null;
  const status = STATUS_STYLE[memory.processing_status];

  return (
    <View style={styles.row}>
      {!inbox ? (
        <TouchableOpacity onPress={onToggleDone} style={styles.check} accessibilityLabel="Toggle done">
          <Text style={styles.checkbox}>{memory.done ? '☑' : '☐'}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.rowIcon}>{icon}</Text>
      )}
      <TouchableOpacity style={styles.rowMain} onPress={onPress}>
        <Text style={[styles.rowTitle, memory.done && styles.rowTitleDone]} numberOfLines={1}>
          {titleText}
        </Text>
        {summary && memory.title ? (
          <Text style={styles.rowSummary} numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
        <View style={styles.chips}>
          {inbox ? (
            <Chip label={status?.label ?? memory.processing_status} color={status?.fg ?? '#374151'} bg={status?.bg ?? '#E5E7EB'} />
          ) : null}
          {!inbox ? (
            <Chip label={subcategoryOf(memory)} color="#4F46E5" bg="#EEF2FF" />
          ) : null}
          {kind ? <Chip label={kind} color="#374151" bg="#E5E7EB" /> : null}
          {prio ? <Chip label={prio.label} color={prio.color} bg={prio.bg} /> : null}
          {typeof memory.spark_score === 'number' ? (
            <Chip label={`⚡ ${memory.spark_score}`} color="#B45309" bg="#FEF3C7" />
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const ItemListScreen = ({ navigation, route }: any) => {
  const { category, subcategory, inbox } = route?.params ?? {};
  const title: string = route?.params?.title ?? category ?? 'Items';
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const load = useCallback(async () => {
    setMemories(await listMemories());
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (inbox) await processMyMemories();
    await load();
    setRefreshing(false);
  }, [load, inbox]);

  const toggleDone = useCallback(async (m: Memory) => {
    const next = !m.done;
    setMemories((prev) => prev.map((x) => (x.id === m.id ? { ...x, done: next } : x)));
    try {
      await setDone(m.id, next);
    } catch {
      // revert on failure
      setMemories((prev) => prev.map((x) => (x.id === m.id ? { ...x, done: !next } : x)));
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const data = inbox ? unprocessed(memories) : itemsIn(memories, category, subcategory);

  return (
    <FlatList
      style={styles.container}
      data={data}
      keyExtractor={(m) => m.id}
      contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => (
        <ItemRow
          memory={item}
          inbox={!!inbox}
          onPress={() => navigation.navigate('MemoryDetail', { id: item.id })}
          onToggleDone={() => toggleDone(item)}
        />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{inbox ? 'Inbox is clear' : 'Nothing here yet'}</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  list: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  check: { paddingRight: 12, paddingTop: 1 },
  checkbox: { fontSize: 22, color: '#6366F1' },
  rowIcon: { fontSize: 26, marginRight: 12 },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#212529' },
  rowTitleDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  rowSummary: { fontSize: 13, color: '#6C757D', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#ADB5BD' },
});

export default ItemListScreen;
