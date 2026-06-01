import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { searchMemories, primaryCategory } from '../lib/api';
import type { Memory } from '../types';

const SearchScreen = ({ navigation }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Memory[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const data = await searchMemories(q);
      setResults(data);
      setSearched(true);
    } catch (e: any) {
      setError(e?.message ?? 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search memories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => runSearch(searchQuery)}
          returnKeyType="search"
          autoCapitalize="none"
          placeholderTextColor="#ADB5BD"
        />
      </View>

      {searching ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={results.length === 0 ? styles.flex : styles.list}
          renderItem={({ item }) => {
            const category = primaryCategory(item);
            const titleText =
              item.title || item.ai_metadata?.summary || item.content_text || item.url || 'Untitled';
            return (
              <TouchableOpacity
                style={styles.result}
                onPress={() => navigation.navigate('MemoryDetail', { id: item.id })}
              >
                <Text style={styles.resultTitle} numberOfLines={1}>
                  {titleText}
                </Text>
                {category ? <Text style={styles.resultCategory}>{category}</Text> : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.placeholder}>
              {error ? (
                <Text style={styles.error}>{error}</Text>
              ) : searched ? (
                <>
                  <Text style={styles.placeholderText}>No results found</Text>
                  <Text style={styles.placeholderSubtext}>
                    Try different keywords or add more memories
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.placeholderText}>Start typing to search</Text>
                  <Text style={styles.placeholderSubtext}>
                    Searches titles, notes, and links
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  searchBar: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchInput: {
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#212529',
  },
  flex: { flexGrow: 1 },
  list: { padding: 16, gap: 10 },
  result: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  resultTitle: { fontSize: 16, fontWeight: '600', color: '#212529' },
  resultCategory: { fontSize: 12, color: '#6366F1', fontWeight: '600', marginTop: 4 },
  placeholder: { flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 18, fontWeight: '600', color: '#ADB5BD', marginBottom: 8 },
  placeholderSubtext: { fontSize: 14, color: '#ADB5BD', textAlign: 'center' },
  error: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
});

export default SearchScreen;
