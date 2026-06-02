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
  subcategoriesOf,
  categoryIcon,
  type SubcategoryGroup,
} from '../lib/api';
import type { Memory } from '../types';

const SubcategoryScreen = ({ navigation, route }: any) => {
  const category: string = route?.params?.category ?? 'Other';
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `${categoryIcon(category)} ${category}` });
  }, [navigation, category]);

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

  const subs = subcategoriesOf(memories, category);
  const total = subs.reduce((n, s) => n + s.count, 0);

  const openItems = (subcategory?: string) =>
    navigation.navigate('ItemList', {
      category,
      subcategory,
      title: subcategory ?? category,
    });

  return (
    <FlatList
      style={styles.container}
      data={subs}
      keyExtractor={(s) => s.name}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <TouchableOpacity style={[styles.row, styles.allRow]} onPress={() => openItems()}>
          <Text style={styles.rowIcon}>🗂️</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>All in {category}</Text>
            <Text style={styles.rowCount}>{total} items</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      }
      renderItem={({ item }: { item: SubcategoryGroup }) => (
        <TouchableOpacity style={styles.row} onPress={() => openItems(item.name)}>
          <Text style={styles.rowIcon}>•</Text>
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={styles.rowCount}>
              {item.count} item{item.count === 1 ? '' : 's'}
              {item.todo > 0 ? ` • ${item.todo} to do` : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  list: { padding: 16, gap: 10 },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  allRow: { backgroundColor: '#EEF2FF' },
  rowIcon: { fontSize: 20, marginRight: 14, color: '#6366F1', width: 24, textAlign: 'center' },
  rowBody: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#212529' },
  rowCount: { fontSize: 13, color: '#6C757D', marginTop: 2 },
  chevron: { fontSize: 24, color: '#CBD5E1', marginLeft: 8 },
  empty: { textAlign: 'center', color: '#ADB5BD', padding: 40 },
});

export default SubcategoryScreen;
