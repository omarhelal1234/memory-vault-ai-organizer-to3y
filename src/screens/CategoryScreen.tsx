import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { listMemories, categoriesOf } from '../lib/api';

// Visual config for the known smart collections; anything else falls under "Other".
const KNOWN: { name: string; icon: string; color: string }[] = [
  { name: 'Movies to Watch', icon: '🎬', color: '#EC4899' },
  { name: 'GitHub Repos', icon: '💻', color: '#8B5CF6' },
  { name: 'AI News', icon: '🤖', color: '#3B82F6' },
  { name: 'Recipes', icon: '🍳', color: '#F59E0B' },
  { name: 'Travel Ideas', icon: '✈️', color: '#06B6D4' },
  { name: 'Shopping', icon: '🛍️', color: '#10B981' },
  { name: 'Other', icon: '📦', color: '#6B7280' },
];

const CategoryScreen = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const memories = await listMemories();
    const tally: Record<string, number> = {};
    for (const m of memories) {
      for (const c of categoriesOf(m)) {
        tally[c] = (tally[c] ?? 0) + 1;
      }
    }
    setCounts(tally);
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
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
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

  // Show known collections plus any AI-invented categories not in the known list.
  const extra = Object.keys(counts).filter((c) => !KNOWN.some((k) => k.name === c));
  const rows = [
    ...KNOWN,
    ...extra.map((name) => ({ name, icon: '🏷️', color: '#94A3B8' })),
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.grid}>
        {rows.map((category) => (
          <View
            key={category.name}
            style={[styles.categoryCard, { borderLeftColor: category.color }]}
          >
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCount}>{counts[category.name] ?? 0} items</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  grid: { padding: 16, gap: 12 },
  categoryCard: {
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
  categoryIcon: { fontSize: 32, marginRight: 16 },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 18, fontWeight: '600', color: '#212529', marginBottom: 4 },
  categoryCount: { fontSize: 14, color: '#6C757D' },
});

export default CategoryScreen;
