import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasFirebaseConfig, db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const KEY_PREFIX = 'qc_tracking_';

export interface DeliveryLocation {
  deliveryBoyId: string;
  deliveryBoyName: string;
  orderId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export async function updateDeliveryLocation(
  deliveryBoyId: string,
  deliveryBoyName: string,
  orderId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  const data: DeliveryLocation = {
    deliveryBoyId, deliveryBoyName, orderId,
    latitude, longitude,
    updatedAt: new Date().toISOString(),
  };

  if (hasFirebaseConfig && db) {
    await setDoc(doc(db, 'tracking', deliveryBoyId), data);
    return;
  }

  await AsyncStorage.setItem(KEY_PREFIX + deliveryBoyId, JSON.stringify(data));
}

export async function getDeliveryLocation(deliveryBoyId: string): Promise<DeliveryLocation | null> {
  if (hasFirebaseConfig && db) {
    const snap = await getDoc(doc(db, 'tracking', deliveryBoyId));
    if (!snap.exists()) return null;
    return snap.data() as DeliveryLocation;
  }

  const raw = await AsyncStorage.getItem(KEY_PREFIX + deliveryBoyId);
  return raw ? JSON.parse(raw) : null;
}

export async function clearDeliveryLocation(deliveryBoyId: string): Promise<void> {
  if (hasFirebaseConfig && db) {
    await deleteDoc(doc(db, 'tracking', deliveryBoyId));
    return;
  }

  await AsyncStorage.removeItem(KEY_PREFIX + deliveryBoyId);
}
