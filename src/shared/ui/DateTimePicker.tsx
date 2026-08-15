import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_FORMAT = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
const VALUE_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

export function DateTimePicker({ value, onChange, required, id }: { value: string; onChange: (value: string) => void; required?: boolean; id?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseValue(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()));

  useEffect(() => {
    if (selected) setView(startOfMonth(selected));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const days = useMemo(() => calendarDays(view), [view]);
  const time = selected ?? new Date();
  const updateTime = (hours: number, minutes: number) => onChange(toValue(withTime(selected ?? new Date(), hours, minutes)));
  const chooseDay = (day: Date) => {
    onChange(toValue(withTime(day, time.getHours(), time.getMinutes())));
  };

  return <div className="date-time-picker" ref={rootRef}>
    <input className="date-time-picker-value" id={id} value={value} readOnly tabIndex={-1} aria-hidden="true" />
    <button className="date-time-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} aria-required={required} onClick={() => setOpen((current) => !current)}>
      <CalendarDays size={18}/><span>{selected ? VALUE_FORMAT.format(selected) : "Выберите дату"}</span><i/><Clock3 size={17}/><span>{selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : "--:--"}</span>
    </button>
    {open ? <div className="date-time-popover" role="dialog" aria-label="Выбор срока выполнения">
      <div className="date-time-month">
        <button type="button" aria-label="Предыдущий месяц" onClick={() => setView(addMonths(view, -1))}><ChevronLeft size={18}/></button>
        <strong aria-live="polite">{MONTH_FORMAT.format(view)}</strong>
        <button type="button" aria-label="Следующий месяц" onClick={() => setView(addMonths(view, 1))}><ChevronRight size={18}/></button>
      </div>
      <div className="date-time-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="date-time-grid" role="grid" aria-label={MONTH_FORMAT.format(view)}>
        {days.map((day) => {
          const currentMonth = day.getMonth() === view.getMonth();
          const active = selected ? sameDay(day, selected) : false;
          const today = sameDay(day, new Date());
          return <button key={toDateKey(day)} type="button" role="gridcell" className={`${currentMonth ? "" : "is-outside"}${active ? " is-selected" : ""}${today ? " is-today" : ""}`} aria-selected={active} aria-label={VALUE_FORMAT.format(day)} onClick={() => chooseDay(day)}>{day.getDate()}</button>;
        })}
      </div>
      <div className="date-time-clock">
        <Clock3 size={17}/><span>Время</span>
        <select aria-label="Часы" value={pad(time.getHours())} onChange={(event) => updateTime(Number(event.target.value), time.getMinutes())}>{range(24).map((hour) => <option key={hour} value={pad(hour)}>{pad(hour)}</option>)}</select>
        <b>:</b>
        <select aria-label="Минуты" value={pad(time.getMinutes())} onChange={(event) => updateTime(time.getHours(), Number(event.target.value))}>{range(60).map((minute) => <option key={minute} value={pad(minute)}>{pad(minute)}</option>)}</select>
      </div>
      <div className="date-time-actions"><button type="button" onClick={() => { const now = new Date(); onChange(toValue(now)); setView(startOfMonth(now)); }}>Сейчас</button><button className="date-time-confirm" type="button" disabled={!selected} onClick={() => setOpen(false)}>Готово</button></div>
    </div> : null}
  </div>;
}

function parseValue(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value); if (!match) return null; const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])); return Number.isNaN(date.getTime()) ? null : date; }
function toValue(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, count: number) { return new Date(date.getFullYear(), date.getMonth() + count, 1); }
function withTime(date: Date, hours: number, minutes: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes); }
function sameDay(left: Date, right: Date) { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
function toDateKey(date: Date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
function range(length: number) { return Array.from({ length }, (_, index) => index); }
function pad(value: number) { return value.toString().padStart(2, "0"); }
function calendarDays(month: Date) { const first = startOfMonth(month); const mondayOffset = (first.getDay() + 6) % 7; const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset); return range(42).map((offset) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)); }
