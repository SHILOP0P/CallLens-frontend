import {
  AlarmClock,
  BellRing,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  RefreshCw,
  UserPlus,
  UserRoundCheck,
  XCircle
} from "lucide-react";
import type { NotificationResponse } from "../../types";

export type NotificationTone = "info" | "success" | "warning" | "danger" | "invitation";

export function notificationPresentation(notification: NotificationResponse) {
  const type = notification.type;
  if (type === "invitation") return { tone: "invitation" as const, label: "Приглашение", icon: UserPlus };
  if (type === "action_completed" || type === "report_ready") return { tone: "success" as const, label: type === "report_ready" ? "Отчёт готов" : "Выполнено", icon: type === "report_ready" ? FileCheck2 : CheckCircle2 };
  if (type === "action_cancelled" || type === "processing_failed") return { tone: "danger" as const, label: type === "processing_failed" ? "Ошибка обработки" : "Отменено", icon: type === "processing_failed" ? CircleAlert : XCircle };
  if (type === "action_overdue" || type === "action_grace_started") return { tone: "danger" as const, label: type === "action_overdue" ? "Просрочено" : "Срок истекает", icon: AlarmClock };
  if (type === "action_reminder" || type === "action_due_changed") return { tone: "warning" as const, label: type === "action_due_changed" ? "Срок изменён" : "Напоминание", icon: BellRing };
  if (type.includes("transfer") || type === "action_reassigned") return { tone: "warning" as const, label: "Передача задачи", icon: RefreshCw };
  if (type === "action_assigned") return { tone: "info" as const, label: "Новая задача", icon: UserRoundCheck };
  if (notification.entity_type === "report") return { tone: "success" as const, label: "Отчёт", icon: FileCheck2 };
  return { tone: "info" as const, label: "Событие", icon: BellRing };
}
