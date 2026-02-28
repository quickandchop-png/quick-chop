import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs, router, usePathname } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import React, { useEffect } from "react";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import WebSidebar, { useIsDesktopWeb } from "@/components/WebSidebar";

const ADMIN_NAV_ITEMS = [
  { name: "index", label: "Dashboard", icon: "stats-chart-outline", activeIcon: "stats-chart" },
  { name: "products", label: "Products", icon: "cube-outline", activeIcon: "cube" },
  { name: "users", label: "Users", icon: "people-outline", activeIcon: "people" },
  { name: "content", label: "Content", icon: "images-outline", activeIcon: "images" },
  { name: "categories", label: "Categories", icon: "grid-outline", activeIcon: "grid" },
  { name: "shops", label: "Shops", icon: "storefront-outline", activeIcon: "storefront" },
  { name: "profile", label: "Profile", icon: "person-outline", activeIcon: "person" },
];

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="products">
        <Icon sf={{ default: "cube", selected: "cube.fill" }} />
        <Label>Products</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users">
        <Icon sf={{ default: "person.3", selected: "person.3.fill" }} />
        <Label>Users</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories">
        <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        <Label>Categories</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shops">
        <Icon sf={{ default: "storefront", selected: "storefront.fill" }} />
        <Label>Shops</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const isDesktop = useIsDesktopWeb();
  const pathname = usePathname();

  const activeRoute = pathname.replace("/(admin)/", "").replace("/(admin)", "").replace(/^\//, "") || "index";

  if (isDesktop) {
    return (
      <WebSidebar
        items={ADMIN_NAV_ITEMS}
        activeRoute={activeRoute}
        onNavigate={(name) => {
          const route = name === "index" ? "/(admin)/" : `/(admin)/${name}`;
          router.push(route as any);
        }}
        title="Admin Panel"
      >
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
          <Tabs.Screen name="products" options={{ title: "Products" }} />
          <Tabs.Screen name="users" options={{ title: "Users" }} />
          <Tabs.Screen name="content" options={{ title: "Content" }} />
          <Tabs.Screen name="categories" options={{ title: "Categories" }} />
          <Tabs.Screen name="shops" options={{ title: "Shops" }} />
          <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        </Tabs>
      </WebSidebar>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 10 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
          borderTopWidth: isWeb ? 1 : 0, borderTopColor: isDark ? "#333" : Colors.border,
          elevation: 0, ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          : isWeb ? <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#000" : "#fff" }]} />
          : null,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
      <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="content" options={{ title: "Content", tabBarIcon: ({ color, size }) => <Ionicons name="images" size={size} color={color} /> }} />
      <Tabs.Screen name="categories" options={{ title: "Categories", tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="shops" options={{ title: "Shops", tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function AdminTabLayout() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.role !== 'admin') {
      router.replace('/(customer)');
    }
  }, [user, isLoading]);

  if (isLoading || user?.role !== 'admin') return null;
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
