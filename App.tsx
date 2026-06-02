import React, { useState } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/lib/auth';
import { reconcileTaxonomy } from './src/lib/api';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import SubcategoryScreen from './src/screens/SubcategoryScreen';
import ItemListScreen from './src/screens/ItemListScreen';
import MemoryDetailScreen from './src/screens/MemoryDetailScreen';
import SearchScreen from './src/screens/SearchScreen';
import CaptureScreen from './src/screens/CaptureScreen';

const Stack = createNativeStackNavigator();

const SignOutButton = () => {
  const { signOut } = useAuth();
  return (
    <TouchableOpacity onPress={() => signOut()}>
      <Text style={styles.headerButton}>Sign out</Text>
    </TouchableOpacity>
  );
};

const HeaderLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress}>
    <Text style={styles.headerButton}>{label}</Text>
  </TouchableOpacity>
);

// Triggers the AI auto-merge pass that collapses near-duplicate categories.
const TidyButton = () => {
  const [busy, setBusy] = useState(false);
  const tidy = async () => {
    if (busy) return;
    setBusy(true);
    const res = await reconcileTaxonomy();
    setBusy(false);
    Alert.alert(
      'Auto-organize',
      res
        ? res.reconciled > 0
          ? `Merged ${res.reconciled} duplicate group(s), moved ${res.rowsMoved} item(s). Pull to refresh.`
          : 'Your categories are already tidy.'
        : 'Could not reach the organizer. Try again.',
    );
  };
  return busy ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <HeaderLink label="✨" onPress={tidy} />
  );
};

const RootNavigator = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#6366F1' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Memory Vault',
          headerLeft: () => (
            <View style={styles.headerRow}>
              <TidyButton />
              <HeaderLink label="🔍" onPress={() => navigation.navigate('Search')} />
            </View>
          ),
          headerRight: () => <SignOutButton />,
        })}
      />
      <Stack.Screen name="Capture" component={CaptureScreen} options={{ title: 'New Memory' }} />
      <Stack.Screen
        name="Subcategory"
        component={SubcategoryScreen}
        options={{ title: 'Category' }}
      />
      <Stack.Screen name="ItemList" component={ItemListScreen} options={{ title: 'Items' }} />
      <Stack.Screen
        name="MemoryDetail"
        component={MemoryDetailScreen}
        options={{ title: 'Memory Details' }}
      />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search Memories' }} />
    </Stack.Navigator>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  headerButton: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  headerRow: { flexDirection: 'row', gap: 16 },
});

export default App;
