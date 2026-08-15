import { Bell, CheckCheck, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../../api";
import type { NotificationResponse } from "../../types";
import { notificationPresentation } from "../../shared/ui/notification-presentation";

const pageSize = 50;

export function NotificationsPage({ onOpen }: { onOpen: (notification: NotificationResponse) => void }) {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listNotifications({ limit: pageSize, offset: 0 })
      .then((response) => {
        if (cancelled) return;
        setNotifications(response.notifications);
        setHasMore(response.notifications.length === pageSize);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить уведомления");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleNotification(event: Event) {
      const notification = (event as CustomEvent<NotificationResponse>).detail;
      if (!notification?.id) return;
      setNotifications((current) => current.some((item) => item.id === notification.id) ? current : [notification, ...current]);
    }
    window.addEventListener("verbatrace:notification-received", handleNotification);
    return () => window.removeEventListener("verbatrace:notification-received", handleNotification);
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const response = await api.listNotifications({ limit: pageSize, offset: notifications.length });
      setNotifications((current) => [...current, ...response.notifications]);
      setHasMore(response.notifications.length === pageSize);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить уведомления");
    } finally {
      setLoadingMore(false);
    }
  }

  async function openNotification(notification: NotificationResponse) {
    if (!notification.read_at) {
      try {
        await api.markNotificationRead(notification.id);
        const readAt = new Date().toISOString();
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
        window.dispatchEvent(new CustomEvent("verbatrace:notification-read", { detail: { id: notification.id, readAt } }));
      } catch {
        // Navigation remains available if marking as read temporarily fails.
      }
    }
    onOpen(notification);
  }

  return (
    <section className="notifications-page">
      <header className="notifications-page-head">
        <span className="notifications-page-icon"><Bell size={22} /></span>
        <div>
          <h1>Все уведомления</h1>
          <p>Полная история событий и напоминаний.</p>
        </div>
      </header>

      {error && <div className="notifications-page-error" role="alert">{error}</div>}
      {loading ? (
        <div className="notifications-page-state"><LoaderCircle className="spin" size={22} /> Загружаем уведомления…</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-page-state">Уведомлений пока нет.</div>
      ) : (
        <div className="notifications-history">
          {notifications.map((notification) => {
            const presentation = notificationPresentation(notification);
            const TypeIcon = presentation.icon;
            return (
            <button
              className={`notification-history-row notification-tone-${presentation.tone} ${notification.read_at ? "" : "unread"}`}
              key={notification.id}
              type="button"
              onClick={() => openNotification(notification)}
            >
              <span className="notification-history-type" title={presentation.label} aria-label={presentation.label}><TypeIcon size={18}/></span>
              <span className="notification-history-content">
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </span>
              <span className="notification-history-side">
                {notification.read_at && <span className="notification-history-read-state" title="Просмотрено" aria-label="Просмотрено"><CheckCheck size={15}/></span>}
                <time>{formatHistoryTime(notification.created_at)}</time>
                <ChevronRight size={17} />
              </span>
            </button>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <button className="notifications-load-more" type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Загружаем…" : "Показать более ранние"}
        </button>
      )}
    </section>
  );
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
