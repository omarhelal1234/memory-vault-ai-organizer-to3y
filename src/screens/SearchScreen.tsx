import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';

const SearchScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search memories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#ADB5BD"
        />
      </View>
      
      <ScrollView style={styles.results}>
        {searchQuery ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No results found</Text>
            <Text style={styles.placeholderSubtext}>
              Try different keywords or add more memories
            </Text>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Start typing to search</Text>
            <Text style={styles.placeholderSubtext}>
              Search across all your memories
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
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
  results: {
    flex: 1,
  },
  placeholder: {
    padding: 40,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ADB5BD',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#ADB5BD',
    textAlign: 'center',
  },
});

export default SearchScreen;