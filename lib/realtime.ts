import { useEffect, useRef, useState, useCallback } from 'react';
import { hasFirebaseConfig, db } from './firebase';
import {
  collection, query, where, orderBy, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { getOrders, Order } from './storage';
import { getNotifications, AppNotification } from './notifications';

const POLL_INTERVAL = 8000;

export function useRealtimeOrders(
  filters: { shopId?: string; customerId?: string; deliveryBoyId?: string; status?: string },
  onNewOrder?: (order: Order) => void,
  onStatusChange?: (order: Order) => void
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const unsubRef = useRef<Unsubscribe | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processResults = useCallback((result: Order[], isFirst: boolean) => {
    setOrders(result);
    setLoading(false);

    if (!isFirst) {
      result.forEach(o => {
        if (!prevIdsRef.current.has(o.id)) {
          if (onNewOrder) onNewOrder(o);
        } else {
          const prevStatus = prevStatusRef.current.get(o.id);
          if (prevStatus && prevStatus !== o.status && onStatusChange) {
            onStatusChange(o);
          }
        }
      });
    }

    prevIdsRef.current = new Set(result.map(o => o.id));
    prevStatusRef.current = new Map(result.map(o => [o.id, o.status]));
  }, [onNewOrder, onStatusChange]);

  const fetchOrders = useCallback(async () => {
    try {
      const result = await getOrders(filters as any);
      const isFirst = prevIdsRef.current.size === 0 && prevStatusRef.current.size === 0;
      processResults(result, isFirst);
    } catch (e) {
      setLoading(false);
    }
  }, [filters.shopId, filters.customerId, filters.deliveryBoyId, filters.status, processResults]);

  useEffect(() => {
    const hasFilter = !!(filters.shopId || filters.customerId || filters.deliveryBoyId || filters.status);
    if (!hasFilter) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    prevIdsRef.current = new Set();
    prevStatusRef.current = new Map();

    if (hasFirebaseConfig && db) {
      let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));

      if (filters.shopId) {
        q = query(collection(db, 'orders'), where('shopId', '==', filters.shopId), orderBy('createdAt', 'desc'));
      } else if (filters.customerId) {
        q = query(collection(db, 'orders'), where('customerId', '==', filters.customerId), orderBy('createdAt', 'desc'));
      } else if (filters.deliveryBoyId) {
        q = query(collection(db, 'orders'), where('deliveryBoyId', '==', filters.deliveryBoyId), orderBy('createdAt', 'desc'));
      } else if (filters.status) {
        q = query(collection(db, 'orders'), where('status', '==', filters.status), orderBy('createdAt', 'desc'));
      }

      let isFirst = true;
      unsubRef.current = onSnapshot(q, (snap) => {
        const result = snap.docs.map(d => ({ ...(d.data() as Order), id: d.id }));
        processResults(result, isFirst);
        isFirst = false;
      }, () => {
        setLoading(false);
      });
    } else {
      fetchOrders();
      pollRef.current = setInterval(fetchOrders, POLL_INTERVAL);
    }

    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [filters.shopId, filters.customerId, filters.deliveryBoyId, filters.status]);

  const refresh = useCallback(() => fetchOrders(), [fetchOrders]);

  return { orders, loading, refresh };
}

export function useRealtimeNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const unsubRef = useRef<Unsubscribe | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifs = useCallback(async () => {
    if (!userId) return;
    const notifs = await getNotifications(userId);
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read).length);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    if (hasFirebaseConfig && db) {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      unsubRef.current = onSnapshot(q, (snap) => {
        const notifs = snap.docs.map(d => ({ ...(d.data() as AppNotification), id: d.id }));
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
      });
    } else {
      fetchNotifs();
      pollRef.current = setInterval(fetchNotifs, POLL_INTERVAL);
    }

    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [userId]);

  return { notifications, unreadCount, refresh: fetchNotifs };
}
