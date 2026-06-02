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
import {
  listMemories,
  processMyMemories,
  topCategories,
  unprocessed,
  type CategoryGroup,
} from '../lib/api';
import type { Memory } from '../types';

const CategoryCard = ({ group, onPress }: { group: CategoryGroup; onPress: () => void }) => (
  <TouchableOpacity style={[styles.card, { borderLeftColor: group.color }]} onPress={onPress}>
    <Text style={styles.cardIcon}>{group.icon}</Text>
    <View style={styles.cardBody}>
      <Text style={styles.cardName} numberOfLines={1}>
        {group.name}
      </Text>
      <Text style={styles.cardCount}>
        {group.count} item{group.count === 1 ? '' : 's'}
        {group.todo > 0 ? ` • ${group.todo} to do` : ''}
      </Text>
    </View>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

const HomeScreen = ({ navigation }: any) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setMemories(await listMemories());
    } catch (e: any) {
      setError(e?.message ?? 'Could not load memories.');
    }
  }, []);

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

  const groups = topCategories(memories);
  const pending = unprocessed(memories);

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.name}
        renderItem={({ item }) => (
          <CategoryCard
            group={item}
            onPress={() => navigation.navigate('Subcategory', { category: item.name })}
          />
        )}
        contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {pending.length > 0 ? (
              <TouchableOpacity
                style={styles.inbox}
                onPress={() => navigation.navigate('ItemList', { inbox: true, title: 'Inbox' })}
              >
                <Text style={styles.inboxIcon}>🕓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inboxTitle}>
                    {pending.length} item{pending.length === 1 ? '' : 's'} processing
                  </Text>
                  <Text style={styles.inboxSub}>Pull to refresh — AI is sorting these</Text>
                </View>
              </TouchableOpacity>
            ) : null}
            {groups.length > 0 ? <Text style={styles.sectionTitle}>Categories</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your vault is empty</Text>
            <Text style={styles.emptySubtitle}>
              Tap ＋ to save a note, link, reel, or screenshot. AI sorts it into categories you can
              drill into.
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
  list: { padding: 16, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: { fontSize: 30, marginRight: 14 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: '600', color: '#212529', marginBottom: 4 },
  cardCount: { fontSize: 14, color: '#6C757D' },
  chevron: { fontSize: 26, color: '#CBD5E1', marginLeft: 8 },
  inbox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inboxIcon: { fontSize: 24, marginRight: 12 },
  inboxTitle: { fontSize: 15, fontWeight: '700', color: '#3730A3' },
  inboxSub: { fontSize: 13, color: '#6366F1', marginTop: 2 },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#ADB5BD', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#ADB5BD', textAlign: 'center', lineHeight: 20 },
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
