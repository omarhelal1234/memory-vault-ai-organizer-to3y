import React from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/lib/auth';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import CategoryScreen from './src/screens/CategoryScreen';
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
              <HeaderLink label="📁" onPress={() => navigation.navigate('Categories')} />
              <HeaderLink label="🔍" onPress={() => navigation.navigate('Search')} />
            </View>
          ),
          headerRight: () => <SignOutButton />,
        })}
      />
      <Stack.Screen name="Capture" component={CaptureScreen} options={{ title: 'New Memory' }} />
      <Stack.Screen
        name="Categories"
        component={CategoryScreen}
        options={{ title: 'Categories' }}
      />
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
