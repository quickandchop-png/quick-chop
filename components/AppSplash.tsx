import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

export default function AppSplash() {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const imageScale = useRef(new Animated.Value(0.92)).current;

  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600, useNativeDriver: nativeDriver,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, tension: 60, friction: 10, useNativeDriver: nativeDriver,
      }),
      Animated.spring(imageScale, {
        toValue: 1, tension: 50, friction: 8, useNativeDriver: nativeDriver,
      }),
    ]).start();
  }, []);

  const webTopPad = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad, paddingBottom: insets.bottom }]}>
      <Animated.View style={[styles.imageWrapper, { opacity: fadeAnim, transform: [{ scale: imageScale }] }]}>
        <Image
          source={require('../assets/images/splash-icon.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.textWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.nameRow}>
          <Text style={styles.appNameBold}>Quick</Text>
          <Text style={styles.ampersand}> &amp; </Text>
          <Text style={styles.appNameLight}>Chop</Text>
        </View>
        <Text style={styles.tagline}>Vegetables · Groceries · Stationery</Text>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotMid]} />
        <View style={styles.dot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: W * 0.78,
    height: H * 0.52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textWrapper: {
    alignItems: 'center',
    marginTop: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  appNameBold: {
    fontSize: 42,
    fontFamily: 'Poppins_700Bold',
    color: '#1B5E20',
    letterSpacing: -0.5,
  },
  ampersand: {
    fontSize: 34,
    fontFamily: 'Poppins_400Regular',
    color: '#FF6F00',
  },
  appNameLight: {
    fontSize: 42,
    fontFamily: 'Poppins_400Regular',
    color: '#1B5E20',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C8E6C9',
  },
  dotMid: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1B5E20',
  },
});
