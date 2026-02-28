import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { hasFirebaseConfig, db } from './firebase';
import {
  collection, doc, getDocs, setDoc, updateDoc, query, where, orderBy,
} from 'firebase/firestore';

const KEY = 'qc_notifications';

export type NotificationType =
  | 'new_order'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_ready'
  | 'delivery_assigned'
  | 'order_picked_up'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'order_canceled'
  | 'order_status_update';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  orderId: string;
  read: boolean;
  createdAt: string;
}

async function localGet(): Promise<AppNotification[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function localSet(items: AppNotification[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  orderId: string
): Promise<AppNotification> {
  const n: AppNotification = {
    id: Crypto.randomUUID(),
    userId, type, title, body, orderId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (hasFirebaseConfig && db) {
    await setDoc(doc(db, 'notifications', n.id), n);
    return n;
  }

  const all = await localGet();
  all.push(n);
  await localSet(all);
  return n;
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  if (hasFirebaseConfig && db) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const items = snap.docs.map(d => d.data() as AppNotification);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const all = await localGet();
  return all
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getUnreadCount(userId: string): Promise<number> {
  const items = await getNotifications(userId);
  return items.filter(n => !n.read).length;
}

export async function markAllRead(userId: string): Promise<void> {
  if (hasFirebaseConfig && db) {
    const items = await getNotifications(userId);
    await Promise.all(
      items.filter(n => !n.read).map(n => updateDoc(doc(db!, 'notifications', n.id), { read: true }))
    );
    return;
  }

  const all = await localGet();
  const updated = all.map(n => n.userId === userId ? { ...n, read: true } : n);
  await localSet(updated);
}

export async function markOneRead(notifId: string): Promise<void> {
  if (hasFirebaseConfig && db) {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
    return;
  }

  const all = await localGet();
  await localSet(all.map(n => n.id === notifId ? { ...n, read: true } : n));
}
