import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const CategoryScreen = () => {
  const categories = [
    { name: 'Movies to Watch', icon: '🎬', color: '#EC4899', count: 0 },
    { name: 'GitHub Repos', icon: '💻', color: '#8B5CF6', count: 0 },
    { name: 'AI News', icon: '🤖', color: '#3B82F6', count: 0 },
    { name: 'Recipes', icon: '🍳', color: '#F59E0B', count: 0 },
    { name: 'Travel Ideas', icon: '✈️', color: '#06B6D4', count: 0 },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {categories.map((category, index) => (
          <View key={index} style={[styles.categoryCard, { borderLeftColor: category.color }]}>
            <Text style={styles.categoryIcon}>{category.icon}</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCount}>{category.count} items</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  grid: {
    padding: 16,
    gap: 12,
  },
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
  categoryIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
    color: '#6C757D',
  },
});

export default CategoryScreen;