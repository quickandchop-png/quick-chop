import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { hasFirebaseConfig, db, auth } from './firebase';
import {
  ref, get, set as rtdbSet, update as rtdbUpdate, remove as rtdbRemove, push, query as rtdbQuery, orderByChild, equalTo
} from 'firebase/database';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from 'firebase/auth';
import { MASTER_PRODUCTS } from './product-master';

export type UserRole = 'customer' | 'shopowner' | 'delivery' | 'admin';
export type ProductCategory = string;

export const CUSTOMER_CARE_CHARGE = 0.50;

export function getCustomerPrice(basePrice: number): number {
  return Math.round((basePrice + CUSTOMER_CARE_CHARGE) * 100) / 100;
}

const MASTER_PRICES: Record<string, number> = {
  v001: 40, v002: 35, v003: 50, v004: 30, v005: 15, v006: 60, v007: 25, v008: 30,
  v009: 45, v010: 35, v011: 30, v012: 40, v013: 35, v014: 60, v015: 80, v016: 60,
  v017: 15, v018: 20, v019: 40, v020: 20, v021: 50, v022: 35, v023: 30,
  g001: 450, g002: 280, g003: 45, g004: 20, g005: 180, g006: 200, g007: 250,
  g008: 140, g009: 120, g010: 220, g011: 280, g012: 120, g013: 95, g014: 30,
  g015: 85, g016: 180, g017: 130, g018: 25, g019: 35, g020: 60, g021: 150,
  g022: 40, g023: 30,
  s001: 85, s002: 120, s003: 60, s004: 25, s005: 30, s006: 180, s007: 150,
  s008: 95, s009: 80, s010: 40, s011: 150, s012: 120, s013: 35, s014: 200,
  s015: 60, s016: 90, s017: 45,
};

export interface AppUser {
  id: string;
  phone: string;
  password: string;
  name: string;
  role: UserRole;
  shopId?: string;
  createdAt: string;
  isActive?: boolean;
  latitude?: number;
  longitude?: number;
  pincode?: string;
  serviceArea?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: ProductCategory;
  shopId: string;
  shopName: string;
  stock: number;
  unit: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderAddress {
  text: string;
  latitude?: number;
  longitude?: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'canceled';
  deliveryBoyId?: string;
  deliveryBoyName?: string;
  address: string;
  addressCoords?: { latitude: number; longitude: number };
  shopId: string;
  shopName: string;
  paymentMethod: 'cod' | 'online' | 'upi';
  paymentStatus: 'cod' | 'pending' | 'paid' | 'failed' | 'upi_pending' | 'upi_paid';
  stripeSessionId?: string;
  commissionAmount: number;
  commissionCollected: boolean;
  deliveryTimeSlot?: string;
  walletDiscount?: number;
  createdAt: string;
}

export interface ShopCommissionStat {
  shopId: string;
  shopName: string;
  totalCommission: number;
  collectedCommission: number;
  outstandingCommission: number;
  orderCount: number;
}

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  category: ProductCategory;
  description: string;
  isActive: boolean;
  latitude?: number;
  longitude?: number;
  upiId?: string;
}

export interface HomeContent {
  videoUrl: string;
  bannerImages: string[];
}

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault?: boolean;
  createdAt: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'vegetables', name: 'Vegetables', icon: 'leaf', color: '#2E7D32', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'groceries', name: 'Groceries', icon: 'basket', color: '#E65100', isDefault: true, createdAt: new Date().toISOString() },
  { id: 'stationery', name: 'Stationery', icon: 'pencil', color: '#1565C0', isDefault: true, createdAt: new Date().toISOString() },
];

export interface UPIAuditEntry {
  timestamp: string;
  previousId: string;
  newId: string;
  changedBy: string;
}

export interface UPIConfig {
  merchantId: string;
  merchantName: string;
  masterPinHash: string;
  auditTrail: UPIAuditEntry[];
}

const DEFAULT_UPI_CONFIG: UPIConfig = {
  merchantId: 'quickchop@upi',
  merchantName: 'Quick & Chop',
  masterPinHash: '',
  auditTrail: [],
};

const DEFAULT_MASTER_PIN = '2580';

const KEYS = {
  USERS: 'qc_users',
  CURRENT_USER: 'qc_current_user',
  PRODUCTS: 'qc_products',
  ORDERS: 'qc_orders',
  SHOPS: 'qc_shops',
  CART: 'qc_cart',
  HOME_CONTENT: 'qc_home_content',
  UPI_CONFIG: 'qc_upi_config',
  CATEGORIES: 'qc_categories',
};

async function getItem<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return defaultValue;
  return JSON.parse(raw) as T;
}

async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ========== DATABASE HELPERS ==========
async function firestoreGetAll<T>(collectionName: string): Promise<T[]> {
  if (!db) return [];
  const snap = await get(ref(db, collectionName));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.keys(data).map(key => ({ id: key, ...data[key] } as T));
}

async function firestoreGetWhere<T>(collectionName: string, field: string, value: any): Promise<T[]> {
  if (!db) return [];
  const q = rtdbQuery(ref(db, collectionName), orderByChild(field), equalTo(value));
  const snap = await get(q);
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.keys(data).map(key => ({ id: key, ...data[key] } as T));
}

async function firestoreSet(collectionName: string, docId: string, data: any): Promise<void> {
  if (!db) return;
  await rtdbSet(ref(db, `${collectionName}/${docId}`), data);
}

async function firestoreAdd(collectionName: string, data: any): Promise<string> {
  if (!db) return '';
  const newRef = push(ref(db, collectionName));
  await rtdbSet(newRef, data);
  return newRef.key as string;
}

async function firestoreUpdate(collectionName: string, docId: string, data: any): Promise<void> {
  if (!db) return;
  await rtdbUpdate(ref(db, `${collectionName}/${docId}`), data);
}

async function firestoreDelete(collectionName: string, docId: string): Promise<void> {
  if (!db) return;
  await rtdbRemove(ref(db, `${collectionName}/${docId}`));
}

async function firestoreGetDoc<T>(collectionName: string, docId: string): Promise<T | null> {
  if (!db) return null;
  const snap = await get(ref(db, `${collectionName}/${docId}`));
  if (!snap.exists()) return null;
  return { id: snap.key, ...snap.val() } as T;
}

// ========== SEED DATA ==========
export async function seedInitialData(): Promise<void> {
  if (hasFirebaseConfig && db) {
    const usersSnap = await get(ref(db, 'users'));
    if (usersSnap.exists()) return;

    const adminId = Crypto.randomUUID();
    const shopOwner1Id = Crypto.randomUUID();
    const shopOwner2Id = Crypto.randomUUID();
    const deliveryId = Crypto.randomUUID();
    const shop1Id = Crypto.randomUUID();
    const shop2Id = Crypto.randomUUID();

    const seedUsers: AppUser[] = [
      { id: adminId, phone: '9999999999', password: 'admin123', name: 'Super Admin', role: 'admin', createdAt: new Date().toISOString() },
      { id: shopOwner1Id, phone: '8888888888', password: 'shop123', name: 'Fresh Farm Store', role: 'shopowner', shopId: shop1Id, createdAt: new Date().toISOString() },
      { id: shopOwner2Id, phone: '7777777777', password: 'shop123', name: 'Paper World', role: 'shopowner', shopId: shop2Id, createdAt: new Date().toISOString() },
      { id: deliveryId, phone: '6666666666', password: 'deliver123', name: 'Raju Delivery', role: 'delivery', createdAt: new Date().toISOString() },
    ];

    const shop3Id = Crypto.randomUUID();
    const seedShops: Shop[] = [
      { id: shop1Id, name: 'Fresh Farm Store', ownerId: shopOwner1Id, ownerName: 'Fresh Farm Store', category: 'vegetables', description: 'Fresh organic vegetables delivered daily', isActive: true, latitude: 12.9716, longitude: 77.5946 },
      { id: shop2Id, name: 'Paper World', ownerId: shopOwner2Id, ownerName: 'Paper World', category: 'stationery', description: 'All your stationery needs in one place', isActive: true, latitude: 12.9352, longitude: 77.6245 },
      { id: shop3Id, name: 'Daily Needs Mart', ownerId: shopOwner1Id, ownerName: 'Daily Needs Mart', category: 'groceries', description: 'Your daily grocery essentials', isActive: true, latitude: 12.9500, longitude: 77.6100 },
    ];

    const seedProducts: Product[] = MASTER_PRODUCTS.map(mp => ({
      id: Crypto.randomUUID(),
      name: mp.name,
      description: mp.defaultDescription,
      price: MASTER_PRICES[mp.id] || 50,
      image: mp.image,
      category: mp.category,
      shopId: mp.category === 'vegetables' ? shop1Id : mp.category === 'groceries' ? shop3Id : shop2Id,
      shopName: mp.category === 'vegetables' ? 'Fresh Farm Store' : mp.category === 'groceries' ? 'Daily Needs Mart' : 'Paper World',
      stock: 30 + Math.floor(Math.random() * 70),
      unit: mp.unit,
    }));

    const seedContent: HomeContent = {
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      bannerImages: [
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600',
        'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600',
        'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600',
        'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
      ],
    };

    for (const u of seedUsers) await firestoreSet('users', u.id, u);
    for (const s of seedShops) await firestoreSet('shops', s.id, s);
    for (const p of seedProducts) await firestoreSet('products', p.id, p);
    await firestoreSet('config', 'homeContent', seedContent);
    return;
  }

  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  if (users.length > 0) {
    const shops = await getItem<Shop[]>(KEYS.SHOPS, []);
    const existingProducts = await getItem<Product[]>(KEYS.PRODUCTS, []);
    const totalMaster = MASTER_PRODUCTS.length;
    if (existingProducts.length < totalMaster) {
      const hasGroceryShop = shops.some(s => s.category === 'groceries');
      let updatedShops = [...shops];
      const vegShop = shops.find(s => s.category === 'vegetables');
      const staShop = shops.find(s => s.category === 'stationery');
      let groShop = shops.find(s => s.category === 'groceries');
      if (!groShop) {
        const owner = users.find(u => u.role === 'shopowner');
        const ownerId = owner?.id || Crypto.randomUUID();
        groShop = { id: Crypto.randomUUID(), name: 'Daily Needs Mart', ownerId, ownerName: 'Daily Needs Mart', category: 'groceries', description: 'Your daily grocery essentials', isActive: true, latitude: 12.9500, longitude: 77.6100 };
        updatedShops.push(groShop);
      }
      const masterByName = new Map(MASTER_PRODUCTS.map(mp => [mp.name.toLowerCase(), mp]));
      const updatedExisting = existingProducts.map(p => {
        const master = masterByName.get(p.name.toLowerCase());
        if (master && (p.image !== master.image || p.unit !== master.unit)) {
          return { ...p, image: master.image, unit: master.unit };
        }
        return p;
      });
      const existingNames = new Set(updatedExisting.map(p => p.name.toLowerCase()));
      const newProducts: Product[] = MASTER_PRODUCTS
        .filter(mp => !existingNames.has(mp.name.toLowerCase()))
        .map(mp => ({
          id: Crypto.randomUUID(),
          name: mp.name,
          description: mp.defaultDescription,
          price: MASTER_PRICES[mp.id] || 50,
          image: mp.image,
          category: mp.category,
          shopId: mp.category === 'vegetables' ? (vegShop?.id || groShop!.id) : mp.category === 'groceries' ? groShop!.id : (staShop?.id || groShop!.id),
          shopName: mp.category === 'vegetables' ? (vegShop?.name || 'Fresh Farm Store') : mp.category === 'groceries' ? groShop!.name : (staShop?.name || 'Paper World'),
          stock: 30 + Math.floor(Math.random() * 70),
          unit: mp.unit,
        }));
      const dataUpdated = updatedExisting.some((p, i) => p.image !== existingProducts[i].image || p.unit !== existingProducts[i].unit);
      if (newProducts.length > 0 || !hasGroceryShop || dataUpdated) {
        await Promise.all([
          setItem(KEYS.SHOPS, updatedShops),
          setItem(KEYS.PRODUCTS, [...updatedExisting, ...newProducts]),
        ]);
      }
    }
    return;
  }

  const adminId = Crypto.randomUUID();
  const shopOwner1Id = Crypto.randomUUID();
  const shopOwner2Id = Crypto.randomUUID();
  const deliveryId = Crypto.randomUUID();
  const shop1Id = Crypto.randomUUID();
  const shop2Id = Crypto.randomUUID();

  const seedUsers: AppUser[] = [
    { id: adminId, phone: '9999999999', password: 'admin123', name: 'Super Admin', role: 'admin', createdAt: new Date().toISOString() },
    { id: shopOwner1Id, phone: '8888888888', password: 'shop123', name: 'Fresh Farm Store', role: 'shopowner', shopId: shop1Id, createdAt: new Date().toISOString() },
    { id: shopOwner2Id, phone: '7777777777', password: 'shop123', name: 'Paper World', role: 'shopowner', shopId: shop2Id, createdAt: new Date().toISOString() },
    { id: deliveryId, phone: '6666666666', password: 'deliver123', name: 'Raju Delivery', role: 'delivery', createdAt: new Date().toISOString() },
  ];

  const shop3Id = Crypto.randomUUID();
  const seedShops: Shop[] = [
    { id: shop1Id, name: 'Fresh Farm Store', ownerId: shopOwner1Id, ownerName: 'Fresh Farm Store', category: 'vegetables', description: 'Fresh organic vegetables delivered daily', isActive: true, latitude: 12.9716, longitude: 77.5946 },
    { id: shop2Id, name: 'Paper World', ownerId: shopOwner2Id, ownerName: 'Paper World', category: 'stationery', description: 'All your stationery needs in one place', isActive: true, latitude: 12.9352, longitude: 77.6245 },
    { id: shop3Id, name: 'Daily Needs Mart', ownerId: shopOwner1Id, ownerName: 'Daily Needs Mart', category: 'groceries', description: 'Your daily grocery essentials', isActive: true, latitude: 12.9500, longitude: 77.6100 },
  ];

  const seedProducts: Product[] = MASTER_PRODUCTS.map(mp => ({
    id: Crypto.randomUUID(),
    name: mp.name,
    description: mp.defaultDescription,
    price: MASTER_PRICES[mp.id] || 50,
    image: mp.image,
    category: mp.category,
    shopId: mp.category === 'vegetables' ? shop1Id : mp.category === 'groceries' ? shop3Id : shop2Id,
    shopName: mp.category === 'vegetables' ? 'Fresh Farm Store' : mp.category === 'groceries' ? 'Daily Needs Mart' : 'Paper World',
    stock: 30 + Math.floor(Math.random() * 70),
    unit: mp.unit,
  }));

  const seedContent: HomeContent = {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    bannerImages: [
      'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600',
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600',
      'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
    ],
  };

  await Promise.all([
    setItem(KEYS.USERS, seedUsers),
    setItem(KEYS.SHOPS, seedShops),
    setItem(KEYS.PRODUCTS, seedProducts),
    setItem(KEYS.ORDERS, []),
    setItem(KEYS.HOME_CONTENT, seedContent),
  ]);
}

// ========== AUTH ==========
export async function login(phone: string, password: string): Promise<AppUser | null> {
  if (hasFirebaseConfig && db && auth) {
    try {
      const email = `${phone}@quickandchop.app`;
      await signInWithEmailAndPassword(auth, email, password);
      const users = await firestoreGetWhere<AppUser>('users', 'phone', phone);
      const user = users.find(u => u.password === password);
      if (user) {
        if (user.isActive === false) throw new Error('Your account has been deactivated. Contact admin.');
        await setItem(KEYS.CURRENT_USER, user);
        return user;
      }
      return null;
    } catch (e: any) {
      if (e.message?.includes('deactivated')) throw e;
      const users = await firestoreGetWhere<AppUser>('users', 'phone', phone);
      const user = users.find(u => u.password === password);
      if (user) {
        if (user.isActive === false) throw new Error('Your account has been deactivated. Contact admin.');
        try {
          const email = `${phone}@quickandchop.app`;
          await createUserWithEmailAndPassword(auth, email, password);
        } catch {}
        await setItem(KEYS.CURRENT_USER, user);
        return user;
      }
      return null;
    }
  }

  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  const user = users.find(u => u.phone === phone && u.password === password);
  if (user) {
    if (user.isActive === false) throw new Error('Your account has been deactivated. Contact admin.');
    await setItem(KEYS.CURRENT_USER, user);
  }
  return user || null;
}

export async function register(phone: string, password: string, name: string, role: UserRole): Promise<AppUser> {
  if (hasFirebaseConfig && db && auth) {
    const existing = await firestoreGetWhere<AppUser>('users', 'phone', phone);
    if (existing.length > 0) throw new Error('Phone number already registered');

    const email = `${phone}@quickandchop.app`;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    } catch (e: any) {
      if (e.code !== 'auth/email-already-in-use') throw e;
    }

    const newUser: AppUser = {
      id: Crypto.randomUUID(),
      phone, password, name, role,
      createdAt: new Date().toISOString(),
    };
    await firestoreSet('users', newUser.id, newUser);
    await setItem(KEYS.CURRENT_USER, newUser);
    return newUser;
  }

  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  const exists = users.find(u => u.phone === phone);
  if (exists) throw new Error('Phone number already registered');

  const newUser: AppUser = {
    id: Crypto.randomUUID(),
    phone, password, name, role,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  await setItem(KEYS.USERS, users);
  await setItem(KEYS.CURRENT_USER, newUser);
  return newUser;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  return getItem<AppUser | null>(KEYS.CURRENT_USER, null);
}

export async function logout(): Promise<void> {
  if (hasFirebaseConfig && auth) {
    try { await signOut(auth); } catch {}
  }
  await AsyncStorage.removeItem(KEYS.CURRENT_USER);
  await AsyncStorage.removeItem(KEYS.CART);
}

// ========== PRODUCTS ==========
export async function getProducts(category?: string, shopId?: string): Promise<Product[]> {
  if (hasFirebaseConfig && db) {
    let products: Product[];
    if (category) {
      products = await firestoreGetWhere<Product>('products', 'category', category);
    } else if (shopId) {
      products = await firestoreGetWhere<Product>('products', 'shopId', shopId);
    } else {
      products = await firestoreGetAll<Product>('products');
    }
    if (shopId && category) {
      products = products.filter(p => p.shopId === shopId);
    }
    return products;
  }

  let products = await getItem<Product[]>(KEYS.PRODUCTS, []);
  if (category) products = products.filter(p => p.category === category);
  if (shopId) products = products.filter(p => p.shopId === shopId);
  return products;
}

export async function addProduct(product: Omit<Product, 'id'>): Promise<Product> {
  if (hasFirebaseConfig && db) {
    const id = Crypto.randomUUID();
    const newProduct: Product = { ...product, id };
    await firestoreSet('products', id, newProduct);
    return newProduct;
  }

  const products = await getItem<Product[]>(KEYS.PRODUCTS, []);
  const newProduct: Product = { ...product, id: Crypto.randomUUID() };
  products.push(newProduct);
  await setItem(KEYS.PRODUCTS, products);
  return newProduct;
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('products', id, updates);
    return firestoreGetDoc<Product>('products', id);
  }

  const products = await getItem<Product[]>(KEYS.PRODUCTS, []);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return null;
  products[index] = { ...products[index], ...updates };
  await setItem(KEYS.PRODUCTS, products);
  return products[index];
}

export async function deleteProduct(id: string): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreDelete('products', id);
    return;
  }

  const products = await getItem<Product[]>(KEYS.PRODUCTS, []);
  await setItem(KEYS.PRODUCTS, products.filter(p => p.id !== id));
}

// ========== CART (always local) ==========
export async function getCart(): Promise<CartItem[]> {
  return getItem<CartItem[]>(KEYS.CART, []);
}

export async function addToCart(product: Product, quantity: number = 1): Promise<CartItem[]> {
  const cart = await getItem<CartItem[]>(KEYS.CART, []);
  const existing = cart.find(item => item.product.id === product.id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ product, quantity });
  }
  await setItem(KEYS.CART, cart);
  return cart;
}

export async function updateCartItem(productId: string, quantity: number): Promise<CartItem[]> {
  let cart = await getItem<CartItem[]>(KEYS.CART, []);
  if (quantity <= 0) {
    cart = cart.filter(item => item.product.id !== productId);
  } else {
    const item = cart.find(item => item.product.id === productId);
    if (item) item.quantity = quantity;
  }
  await setItem(KEYS.CART, cart);
  return cart;
}

export async function clearCart(): Promise<void> {
  await setItem(KEYS.CART, []);
}

// ========== ORDERS ==========
export async function createOrder(
  customerId: string, customerName: string, customerPhone: string,
  items: CartItem[], address: string,
  addressCoords?: { latitude: number; longitude: number },
  paymentMethod: 'cod' | 'online' | 'upi' = 'cod',
  stripeSessionId?: string,
  deliveryTimeSlot?: string,
  walletDiscount?: number
): Promise<Order> {
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const commissionAmount = Math.round(totalQty * CUSTOMER_CARE_CHARGE * 100) / 100;
  let totalAmount = Math.round(items.reduce((sum, item) => sum + getCustomerPrice(item.product.price) * item.quantity, 0) * 100) / 100;
  if (walletDiscount && walletDiscount > 0) {
    totalAmount = Math.max(0, Math.round((totalAmount - walletDiscount) * 100) / 100);
  }

  let paymentStatus: Order['paymentStatus'];
  if (paymentMethod === 'cod') paymentStatus = 'cod';
  else if (paymentMethod === 'upi') paymentStatus = 'upi_pending';
  else paymentStatus = 'pending';

  const newOrder: Order = {
    id: Crypto.randomUUID(),
    customerId, customerName, customerPhone,
    items, totalAmount,
    status: 'pending',
    address,
    addressCoords,
    shopId: items[0]?.product.shopId || '',
    shopName: items[0]?.product.shopName || '',
    paymentMethod,
    paymentStatus,
    stripeSessionId,
    commissionAmount,
    commissionCollected: false,
    deliveryTimeSlot,
    walletDiscount,
    createdAt: new Date().toISOString(),
  };

  if (hasFirebaseConfig && db) {
    await firestoreSet('orders', newOrder.id, newOrder);
  } else {
    const orders = await getItem<Order[]>(KEYS.ORDERS, []);
    orders.push(newOrder);
    await setItem(KEYS.ORDERS, orders);
  }

  await clearCart();
  return newOrder;
}

export async function getOrders(filter?: { customerId?: string; shopId?: string; deliveryBoyId?: string; status?: string }): Promise<Order[]> {
  let orders: Order[];

  if (hasFirebaseConfig && db) {
    if (filter?.customerId) {
      orders = await firestoreGetWhere<Order>('orders', 'customerId', filter.customerId);
    } else if (filter?.shopId) {
      orders = await firestoreGetWhere<Order>('orders', 'shopId', filter.shopId);
    } else if (filter?.deliveryBoyId) {
      orders = await firestoreGetWhere<Order>('orders', 'deliveryBoyId', filter.deliveryBoyId);
    } else if (filter?.status) {
      orders = await firestoreGetWhere<Order>('orders', 'status', filter.status);
    } else {
      orders = await firestoreGetAll<Order>('orders');
    }
  } else {
    orders = await getItem<Order[]>(KEYS.ORDERS, []);
    if (filter?.customerId) orders = orders.filter(o => o.customerId === filter.customerId);
    if (filter?.shopId) orders = orders.filter(o => o.shopId === filter.shopId);
    if (filter?.deliveryBoyId) orders = orders.filter(o => o.deliveryBoyId === filter.deliveryBoyId);
    if (filter?.status) orders = orders.filter(o => o.status === filter.status);
  }

  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateOrderStatus(orderId: string, status: Order['status'], deliveryBoyId?: string, deliveryBoyName?: string): Promise<Order | null> {
  if (hasFirebaseConfig && db) {
    const updates: any = { status };
    if (deliveryBoyId) updates.deliveryBoyId = deliveryBoyId;
    if (deliveryBoyName) updates.deliveryBoyName = deliveryBoyName;
    await firestoreUpdate('orders', orderId, updates);
    return firestoreGetDoc<Order>('orders', orderId);
  }

  const orders = await getItem<Order[]>(KEYS.ORDERS, []);
  const index = orders.findIndex(o => o.id === orderId);
  if (index === -1) return null;
  orders[index].status = status;
  if (deliveryBoyId) orders[index].deliveryBoyId = deliveryBoyId;
  if (deliveryBoyName) orders[index].deliveryBoyName = deliveryBoyName;
  await setItem(KEYS.ORDERS, orders);
  return orders[index];
}

export async function updateOrderAddress(orderId: string, address: string): Promise<Order | null> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('orders', orderId, { address });
    return firestoreGetDoc<Order>('orders', orderId);
  }
  const orders = await getItem<Order[]>(KEYS.ORDERS, []);
  const index = orders.findIndex(o => o.id === orderId);
  if (index === -1) return null;
  orders[index].address = address;
  await setItem(KEYS.ORDERS, orders);
  return orders[index];
}

export async function updatePaymentStatus(orderId: string, paymentStatus: Order['paymentStatus']): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('orders', orderId, { paymentStatus });
    return;
  }

  const orders = await getItem<Order[]>(KEYS.ORDERS, []);
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    orders[index].paymentStatus = paymentStatus;
    await setItem(KEYS.ORDERS, orders);
  }
}

export async function markCommissionCollected(orderId: string): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('orders', orderId, { commissionCollected: true });
    return;
  }
  const orders = await getItem<Order[]>(KEYS.ORDERS, []);
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    orders[index].commissionCollected = true;
    await setItem(KEYS.ORDERS, orders);
  }
}

export async function markShopCommissionCollected(shopId: string): Promise<void> {
  const orders = await getOrders({ shopId });
  const uncollected = orders.filter(o => !o.commissionCollected);
  await Promise.all(uncollected.map(o => markCommissionCollected(o.id)));
}

export async function getCommissionStats(): Promise<ShopCommissionStat[]> {
  const orders = await getOrders();
  const map = new Map<string, ShopCommissionStat>();
  for (const order of orders) {
    if (!map.has(order.shopId)) {
      map.set(order.shopId, {
        shopId: order.shopId,
        shopName: order.shopName,
        totalCommission: 0,
        collectedCommission: 0,
        outstandingCommission: 0,
        orderCount: 0,
      });
    }
    const stat = map.get(order.shopId)!;
    stat.totalCommission = Math.round((stat.totalCommission + (order.commissionAmount || 0)) * 100) / 100;
    stat.orderCount += 1;
    if (order.commissionCollected) {
      stat.collectedCommission = Math.round((stat.collectedCommission + (order.commissionAmount || 0)) * 100) / 100;
    } else {
      stat.outstandingCommission = Math.round((stat.outstandingCommission + (order.commissionAmount || 0)) * 100) / 100;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalCommission - a.totalCommission);
}

// ========== SHOPS ==========
export async function getShops(): Promise<Shop[]> {
  if (hasFirebaseConfig && db) return firestoreGetAll<Shop>('shops');
  return getItem<Shop[]>(KEYS.SHOPS, []);
}

export async function updateShop(id: string, updates: Partial<Shop>): Promise<Shop | null> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('shops', id, updates);
    return firestoreGetDoc<Shop>('shops', id);
  }

  const shops = await getItem<Shop[]>(KEYS.SHOPS, []);
  const index = shops.findIndex(s => s.id === id);
  if (index === -1) return null;
  shops[index] = { ...shops[index], ...updates };
  await setItem(KEYS.SHOPS, shops);
  return shops[index];
}

export async function getShopById(shopId: string): Promise<Shop | null> {
  if (hasFirebaseConfig && db) return firestoreGetDoc<Shop>('shops', shopId);
  const shops = await getItem<Shop[]>(KEYS.SHOPS, []);
  return shops.find(s => s.id === shopId) || null;
}

export async function getShopUPIId(shopId: string): Promise<string> {
  const shop = await getShopById(shopId);
  if (shop?.upiId) return shop.upiId;
  const config = await getUPIConfig();
  return config.merchantId || DEFAULT_UPI_CONFIG.merchantId;
}

export async function getShopCommissionOutstanding(shopId: string): Promise<number> {
  const orders = await getOrders({ shopId });
  let outstanding = 0;
  for (const order of orders) {
    if (!order.commissionCollected && order.commissionAmount) {
      outstanding = Math.round((outstanding + order.commissionAmount) * 100) / 100;
    }
  }
  return outstanding;
}

// ========== HOME CONTENT ==========
export async function getHomeContent(): Promise<HomeContent> {
  if (hasFirebaseConfig && db) {
    const content = await firestoreGetDoc<HomeContent>('config', 'homeContent');
    return content || { videoUrl: '', bannerImages: [] };
  }
  return getItem<HomeContent>(KEYS.HOME_CONTENT, { videoUrl: '', bannerImages: [] });
}

export async function updateHomeContent(content: Partial<HomeContent>): Promise<HomeContent> {
  if (hasFirebaseConfig && db) {
    const current = await getHomeContent();
    const updated = { ...current, ...content };
    await firestoreSet('config', 'homeContent', updated);
    return updated;
  }

  const current = await getHomeContent();
  const updated = { ...current, ...content };
  await setItem(KEYS.HOME_CONTENT, updated);
  return updated;
}

// ========== UPI CONFIG (Admin-only) ==========
async function hashMasterPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `qc_upi_master:${pin}`);
}

export async function getUPIConfig(): Promise<UPIConfig> {
  let config: UPIConfig | null = null;
  if (hasFirebaseConfig && db) {
    config = await firestoreGetDoc<UPIConfig>('config', 'upiSettings');
  } else {
    config = await getItem<UPIConfig | null>(KEYS.UPI_CONFIG, null);
  }
  if (!config) return { ...DEFAULT_UPI_CONFIG };
  return config;
}

export async function getUPIActiveMerchantId(): Promise<string> {
  const config = await getUPIConfig();
  return config.merchantId || DEFAULT_UPI_CONFIG.merchantId;
}

export async function verifyUPIMasterPin(pin: string): Promise<boolean> {
  const config = await getUPIConfig();
  if (!config.masterPinHash) {
    return pin === DEFAULT_MASTER_PIN;
  }
  const hashed = await hashMasterPin(pin);
  return hashed === config.masterPinHash;
}

export async function changeUPIMasterPin(currentPin: string, newPin: string): Promise<boolean> {
  const valid = await verifyUPIMasterPin(currentPin);
  if (!valid) return false;
  const config = await getUPIConfig();
  const newHash = await hashMasterPin(newPin);
  const updated = { ...config, masterPinHash: newHash };
  if (hasFirebaseConfig && db) {
    await firestoreSet('config', 'upiSettings', updated);
  } else {
    await setItem(KEYS.UPI_CONFIG, updated);
  }
  return true;
}

export async function updateUPIMerchantId(newId: string, adminName: string, masterPin: string): Promise<{ success: boolean; error?: string }> {
  const valid = await verifyUPIMasterPin(masterPin);
  if (!valid) return { success: false, error: 'Incorrect master PIN' };

  const config = await getUPIConfig();
  const entry: UPIAuditEntry = {
    timestamp: new Date().toISOString(),
    previousId: config.merchantId,
    newId: newId.trim(),
    changedBy: adminName,
  };
  const updated: UPIConfig = {
    ...config,
    merchantId: newId.trim(),
    auditTrail: [entry, ...config.auditTrail],
  };
  if (hasFirebaseConfig && db) {
    await firestoreSet('config', 'upiSettings', updated);
  } else {
    await setItem(KEYS.UPI_CONFIG, updated);
  }
  return { success: true };
}

export async function initUPIMasterPin(pin: string): Promise<void> {
  const config = await getUPIConfig();
  if (config.masterPinHash) return;
  const hashed = await hashMasterPin(pin);
  const updated = { ...config, masterPinHash: hashed };
  if (hasFirebaseConfig && db) {
    await firestoreSet('config', 'upiSettings', updated);
  } else {
    await setItem(KEYS.UPI_CONFIG, updated);
  }
}

// ========== USERS (Admin) ==========
export async function getAllUsers(): Promise<AppUser[]> {
  if (hasFirebaseConfig && db) return firestoreGetAll<AppUser>('users');
  return getItem<AppUser[]>(KEYS.USERS, []);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<AppUser | null> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('users', userId, { role });
    return firestoreGetDoc<AppUser>('users', userId);
  }

  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return null;
  users[index].role = role;
  await setItem(KEYS.USERS, users);
  return users[index];
}

export async function deleteUser(userId: string): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreDelete('users', userId);
    return;
  }

  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  await setItem(KEYS.USERS, users.filter(u => u.id !== userId));
}

export async function getDeliveryBoys(): Promise<AppUser[]> {
  if (hasFirebaseConfig && db) return firestoreGetWhere<AppUser>('users', 'role', 'delivery');

  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  return users.filter(u => u.role === 'delivery');
}

export function isFirebaseEnabled(): boolean {
  return hasFirebaseConfig;
}

// ========== CUSTOMER QUICK REGISTRATION ==========
export async function registerCustomer(phone: string, name: string): Promise<AppUser> {
  const autoPassword = `qc_${phone}_${Date.now()}`;
  return register(phone, autoPassword, name, 'customer');
}

export async function findCustomerByPhone(phone: string): Promise<AppUser | null> {
  if (hasFirebaseConfig && db) {
    const users = await firestoreGetWhere<AppUser>('users', 'phone', phone);
    return users[0] || null;
  }
  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  return users.find(u => u.phone === phone) || null;
}

// ========== PIN MANAGEMENT ==========
const PIN_PREFIX = '@qc_pin_';

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = `${pin}:${salt}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

export async function setUserPin(userId: string, pin: string): Promise<void> {
  const salt = userId;
  const hashed = await hashPin(pin, salt);
  await AsyncStorage.setItem(`${PIN_PREFIX}${userId}`, hashed);
}

export async function verifyUserPin(userId: string, pin: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(`${PIN_PREFIX}${userId}`);
  if (!stored) return false;
  const hashed = await hashPin(pin, userId);
  return hashed === stored;
}

export async function hasUserPin(userId: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(`${PIN_PREFIX}${userId}`);
  return !!stored;
}

// ========== ADMIN STAFF MANAGEMENT ==========
export interface StaffLocationData {
  latitude?: number;
  longitude?: number;
  pincode?: string;
  serviceArea?: string;
}

export async function createStaff(name: string, phone: string, password: string, role: 'shopowner' | 'delivery', locationData?: StaffLocationData): Promise<AppUser> {
  if (hasFirebaseConfig && db) {
    const existing = await firestoreGetWhere<AppUser>('users', 'phone', phone);
    if (existing.length > 0) throw new Error('Phone number already registered');
  } else {
    const users = await getItem<AppUser[]>(KEYS.USERS, []);
    if (users.find(u => u.phone === phone)) throw new Error('Phone number already registered');
  }

  if (role === 'shopowner') {
    const shopId = Crypto.randomUUID();
    const userId = Crypto.randomUUID();
    const newUser: AppUser = {
      id: userId, phone, password, name, role,
      shopId, isActive: true, createdAt: new Date().toISOString(),
      ...(locationData?.latitude != null && { latitude: locationData.latitude }),
      ...(locationData?.longitude != null && { longitude: locationData.longitude }),
      ...(locationData?.pincode && { pincode: locationData.pincode }),
    };
    const newShop: Shop = {
      id: shopId, name, ownerId: userId, ownerName: name,
      category: 'groceries', description: name + "'s shop", isActive: true,
      ...(locationData?.latitude != null && { latitude: locationData.latitude }),
      ...(locationData?.longitude != null && { longitude: locationData.longitude }),
    };
    if (hasFirebaseConfig && db) {
      const email = phone + '@quickandchop.app';
      try {
        await createUserWithEmailAndPassword(auth!, email, password);
      } catch (e: any) { if (e.code !== 'auth/email-already-in-use') throw e; }
      await firestoreSet('users', userId, newUser);
      await firestoreSet('shops', shopId, newShop);
    } else {
      const users = await getItem<AppUser[]>(KEYS.USERS, []);
      users.push(newUser);
      await setItem(KEYS.USERS, users);
      const shops = await getItem<Shop[]>(KEYS.SHOPS, []);
      shops.push(newShop);
      await setItem(KEYS.SHOPS, shops);
    }
    return newUser;
  }

  const userId = Crypto.randomUUID();
  const newUser: AppUser = {
    id: userId, phone, password, name, role,
    isActive: true, createdAt: new Date().toISOString(),
    ...(locationData?.latitude != null && { latitude: locationData.latitude }),
    ...(locationData?.longitude != null && { longitude: locationData.longitude }),
    ...(locationData?.pincode && { pincode: locationData.pincode }),
    ...(locationData?.serviceArea && { serviceArea: locationData.serviceArea }),
  };

  if (hasFirebaseConfig && db) {
    const email = phone + '@quickandchop.app';
    try {
      await createUserWithEmailAndPassword(auth!, email, password);
    } catch (e: any) { if (e.code !== 'auth/email-already-in-use') throw e; }
    await firestoreSet('users', userId, newUser);
  } else {
    const users = await getItem<AppUser[]>(KEYS.USERS, []);
    users.push(newUser);
    await setItem(KEYS.USERS, users);
  }
  return newUser;
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('users', userId, { isActive });
    return;
  }
  const users = await getItem<AppUser[]>(KEYS.USERS, []);
  const idx = users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    users[idx].isActive = isActive;
    await setItem(KEYS.USERS, users);
  }
}

// ========== CATEGORIES ==========
export async function getCategories(): Promise<CategoryItem[]> {
  let custom: CategoryItem[] = [];
  if (hasFirebaseConfig && db) {
    custom = await firestoreGetAll<CategoryItem>('categories');
  } else {
    custom = await getItem<CategoryItem[]>(KEYS.CATEGORIES, []);
  }
  const defaultIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));
  const merged = [...DEFAULT_CATEGORIES];
  for (const c of custom) {
    if (defaultIds.has(c.id)) {
      const idx = merged.findIndex(m => m.id === c.id);
      if (idx !== -1) merged[idx] = { ...merged[idx], ...c, isDefault: true };
    } else {
      merged.push(c);
    }
  }
  return merged;
}

export async function addCategory(cat: Omit<CategoryItem, 'id' | 'createdAt'>): Promise<CategoryItem> {
  const id = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const newCat: CategoryItem = { ...cat, id, createdAt: new Date().toISOString() };
  if (hasFirebaseConfig && db) {
    await firestoreSet('categories', id, newCat);
  } else {
    const cats = await getItem<CategoryItem[]>(KEYS.CATEGORIES, []);
    const exists = cats.find(c => c.id === id);
    if (exists) throw new Error('Category already exists');
    cats.push(newCat);
    await setItem(KEYS.CATEGORIES, cats);
  }
  return newCat;
}

export async function updateCategory(id: string, updates: Partial<CategoryItem>): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreUpdate('categories', id, updates);
  } else {
    const cats = await getItem<CategoryItem[]>(KEYS.CATEGORIES, []);
    const idx = cats.findIndex(c => c.id === id);
    if (idx !== -1) {
      cats[idx] = { ...cats[idx], ...updates };
      await setItem(KEYS.CATEGORIES, cats);
    } else {
      const defaultCat = DEFAULT_CATEGORIES.find(c => c.id === id);
      if (defaultCat) {
        cats.push({ ...defaultCat, ...updates });
        await setItem(KEYS.CATEGORIES, cats);
      }
    }
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const defaultIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));
  if (defaultIds.has(id)) throw new Error('Cannot delete default category');
  if (hasFirebaseConfig && db) {
    await firestoreDelete('categories', id);
  } else {
    const cats = await getItem<CategoryItem[]>(KEYS.CATEGORIES, []);
    await setItem(KEYS.CATEGORIES, cats.filter(c => c.id !== id));
  }
}

// ========== WALLET / REWARDS ==========
const WALLET_KEY_PREFIX = 'qc_wallet_';
const REWARD_PERCENT_KEY = 'qc_reward_percent';

export async function getRewardPercent(): Promise<number> {
  if (hasFirebaseConfig && db) {
    const data = await firestoreGetDoc<{ percent: number }>('settings', 'reward_percent');
    return data?.percent ?? 1;
  }
  const raw = await AsyncStorage.getItem(REWARD_PERCENT_KEY);
  return raw ? parseFloat(raw) : 1;
}

export async function setRewardPercent(percent: number): Promise<void> {
  if (hasFirebaseConfig && db) {
    await firestoreSet('settings', 'reward_percent', { percent });
  } else {
    await AsyncStorage.setItem(REWARD_PERCENT_KEY, String(percent));
  }
}

export async function getWalletBalance(customerId: string): Promise<number> {
  if (hasFirebaseConfig && db) {
    const data = await firestoreGetDoc<{ balance: number }>('wallets', customerId);
    return data?.balance ?? 0;
  }
  const raw = await AsyncStorage.getItem(WALLET_KEY_PREFIX + customerId);
  return raw ? parseFloat(raw) : 0;
}

export async function getAllWalletBalances(customerIds: string[]): Promise<Record<string, number>> {
  const balances: Record<string, number> = {};
  for (const id of customerIds) {
    balances[id] = await getWalletBalance(id);
  }
  return balances;
}

export async function addWalletReward(customerId: string, orderAmount: number): Promise<number> {
  const percent = await getRewardPercent();
  const reward = Math.round(orderAmount * (percent / 100) * 100) / 100;
  if (reward <= 0) return await getWalletBalance(customerId);
  const current = await getWalletBalance(customerId);
  const newBalance = Math.round((current + reward) * 100) / 100;
  if (hasFirebaseConfig && db) {
    await firestoreSet('wallets', customerId, { balance: newBalance });
  } else {
    await AsyncStorage.setItem(WALLET_KEY_PREFIX + customerId, String(newBalance));
  }
  return newBalance;
}

export async function redeemWallet(customerId: string, amount: number): Promise<number> {
  const current = await getWalletBalance(customerId);
  if (current < 100) throw new Error('Wallet balance must be at least ₹100 to redeem');
  const deduction = Math.min(amount, current);
  const newBalance = Math.round((current - deduction) * 100) / 100;
  if (hasFirebaseConfig && db) {
    await firestoreSet('wallets', customerId, { balance: newBalance });
  } else {
    await AsyncStorage.setItem(WALLET_KEY_PREFIX + customerId, String(newBalance));
  }
  return newBalance;
}
