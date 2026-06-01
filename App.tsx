import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import MemoryDetailScreen from './src/screens/MemoryDetailScreen';
import SearchScreen from './src/screens/SearchScreen';

const Stack = createNativeStackNavigator();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#6366F1',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: 'Memory Vault' }}
        />
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
        <Stack.Screen 
          name="Search" 
          component={SearchScreen}
          options={{ title: 'Search Memories' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;