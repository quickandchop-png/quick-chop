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

const SHOP_NAV_ITEMS = [
  { name: "index", label: "Dashboard", icon: "stats-chart-outline", activeIcon: "stats-chart" },
  { name: "products", label: "Products", icon: "bag-outline", activeIcon: "bag" },
  { name: "orders", label: "Orders", icon: "receipt-outline", activeIcon: "receipt" },
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
        <Icon sf={{ default: "bag", selected: "bag.fill" }} />
        <Label>Products</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <Icon sf={{ default: "list.clipboard", selected: "list.clipboard.fill" }} />
        <Label>Orders</Label>
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

  const activeRoute = pathname.replace("/(shopowner)/", "").replace("/(shopowner)", "").replace(/^\//, "") || "index";

  if (isDesktop) {
    return (
      <WebSidebar
        items={SHOP_NAV_ITEMS}
        activeRoute={activeRoute}
        onNavigate={(name) => {
          const route = name === "index" ? "/(shopowner)/" : `/(shopowner)/${name}`;
          router.push(route as any);
        }}
        title="Shop Panel"
      >
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
          <Tabs.Screen name="products" options={{ title: "Products" }} />
          <Tabs.Screen name="orders" options={{ title: "Orders" }} />
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
        tabBarLabelStyle: { fontFamily: 'Poppins_500Medium', fontSize: 11 },
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
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: ({ color, size }) => <Ionicons name="bag" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}

export default function ShopOwnerTabLayout() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.role !== 'shopowner') {
      router.replace('/(customer)');
    }
  }, [user, isLoading]);

  if (isLoading || user?.role !== 'shopowner') return null;
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
