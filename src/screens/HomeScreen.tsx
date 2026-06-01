import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const HomeScreen = ({ navigation }: any) => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Memories</Text>
        <Text style={styles.subtitle}>AI-organized collections</Text>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Categories')}
        >
          <Text style={styles.actionButtonText}>📁 Browse Categories</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Search')}
        >
          <Text style={styles.actionButtonText}>🔍 Search Memories</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>No memories yet</Text>
        <Text style={styles.placeholderSubtext}>
          Start capturing screenshots, voice memos, and notes
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6C757D',
  },
  quickActions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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

export default HomeScreen;