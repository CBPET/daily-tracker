import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markAsRead,
  sendNotification,
} from '../../lib/notifications/notificationService';
import { isNotificationsEnabled } from '../../lib/featureFlags';

const NotificationContext = createContext(null);

export function NotificationProvider({ children, enabled = true }) {
  const active = enabled && isNotificationsEnabled();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        getNotifications({ limit: centerOpen ? 50 : 20 }),
        getUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      console.warn('Notifications refresh failed:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [active, centerOpen]);

  useEffect(() => {
    if (!active) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }
    refreshNotifications();
    return undefined;
  }, [active, refreshNotifications]);

  const value = useMemo(
    () => ({
      enabled: active,
      notifications,
      unreadCount,
      loading,
      drawerOpen,
      setDrawerOpen,
      centerOpen,
      setCenterOpen,
      refreshNotifications,
      markAsRead: async (id) => {
        await markAsRead(id);
        await refreshNotifications();
      },
      markAllRead: async () => {
        await markAllRead();
        await refreshNotifications();
      },
      deleteNotification: async (id) => {
        await deleteNotification(id);
        await refreshNotifications();
      },
      sendNotification,
    }),
    [active, notifications, unreadCount, loading, drawerOpen, centerOpen, refreshNotifications]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      enabled: false,
      notifications: [],
      unreadCount: 0,
      loading: false,
      drawerOpen: false,
      setDrawerOpen: () => {},
      centerOpen: false,
      setCenterOpen: () => {},
      refreshNotifications: async () => {},
      markAsRead: async () => {},
      markAllRead: async () => {},
      deleteNotification: async () => {},
      sendNotification: async () => {},
    };
  }
  return ctx;
}
