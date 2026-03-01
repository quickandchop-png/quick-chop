import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

const SIDEBAR_WIDTH = 220;
const DESKTOP_BREAKPOINT = 768;

type NavItem = {
  name: string;
  label: string;
  icon: string;
  activeIcon: string;
};

type Props = {
  items: NavItem[];
  activeRoute: string;
  onNavigate: (name: string) => void;
  title: string;
  children: React.ReactNode;
};

export function useIsDesktopWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

export default function WebSidebar({ items, activeRoute, onNavigate, title, children }: Props) {
  return (
    <View style={sidebarStyles.wrapper}>
      <View style={sidebarStyles.sidebar}>
        <View style={sidebarStyles.logoRow}>
          <View style={sidebarStyles.logoCircle}>
            <Ionicons name="flash" size={18} color="#fff" />
          </View>
          <Text style={sidebarStyles.logoText}>{title}</Text>
        </View>
        <View style={sidebarStyles.navList}>
          {items.map((item) => {
            const isActive = activeRoute === item.name;
            return (
              <Pressable
                key={item.name}
                style={[sidebarStyles.navItem, isActive && sidebarStyles.navItemActive]}
                onPress={() => onNavigate(item.name)}
              >
                <Ionicons
                  name={(isActive ? item.activeIcon : item.icon) as any}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textTertiary}
                />
                <Text style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={sidebarStyles.content}>
        {children}
      </View>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: 20,
    paddingHorizontal: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 8,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
  },
  navList: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: Colors.primary + '12',
  },
  navLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textTertiary,
  },
  navLabelActive: {
    color: Colors.primary,
    fontFamily: 'Poppins_600SemiBold',
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
    maxWidth: 1200,
  },
});

export { SIDEBAR_WIDTH, DESKTOP_BREAKPOINT };
