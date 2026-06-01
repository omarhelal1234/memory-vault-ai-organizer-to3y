import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// TODO: Import screens once implemented
// import { HomeScreen } from './src/screens/HomeScreen';
// import { CategoryScreen } from './src/screens/CategoryScreen';
// import { MemoryDetailScreen } from './src/screens/MemoryDetailScreen';
// import { SearchScreen } from './src/screens/SearchScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="Home">
          {/* TODO: Add screens once implemented */}
          {/* <Stack.Screen name="Home" component={HomeScreen} /> */}
          {/* <Stack.Screen name="Category" component={CategoryScreen} /> */}
          {/* <Stack.Screen name="MemoryDetail" component={MemoryDetailScreen} /> */}
          {/* <Stack.Screen name="Search" component={SearchScreen} /> */}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
