import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function IndexScreen() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(customer)');
      return;
    }
    switch (user.role) {
      case 'customer': router.replace('/(customer)'); break;
      case 'shopowner': router.replace('/(shopowner)'); break;
      case 'delivery': router.replace('/(delivery)'); break;
      case 'admin': router.replace('/(admin)'); break;
      default: router.replace('/(customer)');
    }
  }, [isLoading, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
});
