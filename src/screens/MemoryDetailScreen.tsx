import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const MemoryDetailScreen = () => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Memory Details</Text>
        <Text style={styles.placeholder}>Select a memory to view details</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default MemoryDetailScreen;