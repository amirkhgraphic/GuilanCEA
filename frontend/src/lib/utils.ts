import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type * as Types from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatJalali(iso?: string, withTime: boolean = true): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);

    // آیا تقویم Persian در محیط کاربر پشتیبانی می‌شود؟
    const hasPersian =
      Intl.DateTimeFormat.supportedLocalesOf(['fa-IR-u-ca-persian']).length > 0;

    if (hasPersian) {
      const datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);

      if (!withTime) return datePart;

      const timePart = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        // اگر 24ساعته می‌خوای: hourCycle: 'h23'
      }).format(d);

      return `${datePart}، ساعت ${timePart}`;
    }

    // fallback: اگر Persian calendar نباشه، حداقل فارسیِ میلادی
    if (withTime) {
      return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(d);
    } else {
      return new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'full',
      }).format(d);
    }
  } catch {
    return '—';
  }
}

const DEFAULT_THUMB = '/images/event-placeholder.svg';
export const getThumbUrl = (e: Types.EventListItemSchema) =>
  e.absolute_featured_image_url ||
  e.featured_image ||
  DEFAULT_THUMB;