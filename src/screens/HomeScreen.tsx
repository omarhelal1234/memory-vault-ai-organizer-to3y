import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { listMemories, processMyMemories, primaryCategory } from '../lib/api';
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

const MemoryRow = ({ memory, onPress }: { memory: Memory; onPress: () => void }) => {
  const status = STATUS_STYLE[memory.processing_status] ?? STATUS_STYLE.pending;
  const category = primaryCategory(memory);
  const summary = memory.ai_metadata?.summary;
  const titleText =
    memory.title || summary || memory.content_text || memory.url || 'Untitled memory';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{TYPE_ICON[memory.type] ?? '📦'}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {titleText}
        </Text>
        {summary && memory.title ? (
          <Text style={styles.rowSummary} numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
          </View>
          {category ? <Text style={styles.category}>{category}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }: any) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listMemories();
      setMemories(data);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load memories.');
    }
  }, []);

  // Initial load + reload whenever the screen regains focus.
  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Nudge the AI processor, then reload to show updated statuses.
    await processMyMemories();
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MemoryRow
            memory={item}
            onPress={() => navigation.navigate('MemoryDetail', { id: item.id })}
          />
        )}
        contentContainerStyle={memories.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No memories yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap + to capture a note, link, or image. AI will organize it for you.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Capture')}
        accessibilityLabel="Add memory"
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
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
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rowIcon: { fontSize: 28, marginRight: 14 },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#212529' },
  rowSummary: { fontSize: 13, color: '#6C757D', marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  category: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#ADB5BD', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#ADB5BD', textAlign: 'center' },
  error: { color: '#DC2626', fontSize: 14, padding: 12, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    backgroundColor: '#6366F1',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '300' },
});

export default HomeScreen;
