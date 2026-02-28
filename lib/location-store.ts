import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'qc_picked_location';
const SAVED_KEY = 'qc_saved_addresses';

export interface PickedLocation {
  address: string;
  latitude: number;
  longitude: number;
  pickedAt: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  savedAt: string;
}

export async function savePickedLocation(loc: PickedLocation): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(loc));
}

export async function getPickedLocation(): Promise<PickedLocation | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw) as PickedLocation;
}

export async function clearPickedLocation(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const raw = await AsyncStorage.getItem(SAVED_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SavedAddress[];
}

export async function addSavedAddress(addr: Omit<SavedAddress, 'id' | 'savedAt'>): Promise<SavedAddress> {
  const addresses = await getSavedAddresses();
  const existing = addresses.find(a => a.address === addr.address);
  if (existing) return existing;
  const newAddr: SavedAddress = {
    ...addr,
    id: Date.now().toString(),
    savedAt: new Date().toISOString(),
  };
  addresses.unshift(newAddr);
  if (addresses.length > 10) addresses.pop();
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(addresses));
  return newAddr;
}

export async function removeSavedAddress(id: string): Promise<void> {
  const addresses = await getSavedAddresses();
  const filtered = addresses.filter(a => a.id !== id);
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
}

export async function saveCurrentAsSaved(label: string): Promise<SavedAddress | null> {
  const current = await getPickedLocation();
  if (!current) return null;
  return addSavedAddress({
    label,
    address: current.address,
    latitude: current.latitude,
    longitude: current.longitude,
  });
}
