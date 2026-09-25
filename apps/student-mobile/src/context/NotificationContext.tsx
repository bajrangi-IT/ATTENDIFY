import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface MobileNotification {
  id: string;
  title: string;
  message: string;
  type: 'session_opened' | 'attendance_result' | 'timetable_change' | 'low_attendance' | 'report_update' | 'correction_status' | 'info';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: MobileNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  sendLocalNotification: (notification: Omit<MobileNotification, 'id' | 'timestamp' | 'read'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<MobileNotification[]>([
    {
      id: 'notif-1',
      title: 'Active Session Started',
      message: 'Operating Systems (CS501) attendance is now open in LH-101. Point camera to scan dynamic QR.',
      type: 'session_opened',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: 'notif-2',
      title: 'Attendance Shortage Alert',
      message: 'Your overall attendance is approaching the 75% statutory examination threshold.',
      type: 'low_attendance',
      timestamp: new Date(Date.now() - 3600 * 1000).toISOString(),
      read: false,
    },
    {
      id: 'notif-3',
      title: 'Timetable Adjustment',
      message: 'Room assignment for OS & DBMS Lab updated to CS-LAB3 for today.',
      type: 'timetable_change',
      timestamp: new Date(Date.now() - 86400 * 1000).toISOString(),
      read: true,
    }
  ]);

  // Load notifications from DB if available
  useEffect(() => {
    if (!profile?.id) return;

    async function loadDbNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        const formatted: MobileNotification[] = data.map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type || 'info',
          timestamp: n.created_at,
          read: !!n.read_at,
          actionUrl: n.action_url
        }));
        setNotifications(formatted);
      }
    }

    loadDbNotifications();

    // Supabase Realtime channel for instant push updates
    const channel = supabase
      .channel(`mobile-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`
        },
        (payload) => {
          const newN: MobileNotification = {
            id: payload.new.id,
            title: payload.new.title,
            message: payload.new.message,
            type: payload.new.type || 'info',
            timestamp: payload.new.created_at,
            read: false,
            actionUrl: payload.new.action_url
          };
          setNotifications((prev) => [newN, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const sendLocalNotification = (notif: Omit<MobileNotification, 'id' | 'timestamp' | 'read'>) => {
    const item: MobileNotification = {
      ...notif,
      id: `local-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [item, ...prev]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        sendLocalNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
