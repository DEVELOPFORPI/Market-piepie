import { api } from "@/utils/api";
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/common/TopBar';
import { getOrderById, updateOrderMeetup, cancelOrderMeetup } from '@/utils/orderStorage';
import { addMeetupConfirmedToChat, addMeetupUpdatedToChat, addMeetupCancelledToChat } from '@/utils/chatStorage';
import { addNotification } from '@/utils/notificationStorage';
import { getCurrentUserId } from '@/utils/authStorage';
import { NOTIFY_MEETUP_CANCELED, NOTIFY_MEETUP_CONFIRMED, NOTIFY_MEETUP_UPDATED } from '@/locale/enUI';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** 24h H:MM or HH:MM (built from English AM/PM selects) */
const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

function CalendarGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function time24ToParts(t: string): { h12: number; min: number; ap: 'AM' | 'PM' } | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (h === 0) return { h12: 12, min, ap: 'AM' };
  if (h === 12) return { h12: 12, min, ap: 'PM' };
  if (h < 12) return { h12: h, min, ap: 'AM' };
  return { h12: h - 12, min, ap: 'PM' };
}

function partsToTime24(h12: number, min: number, ap: 'AM' | 'PM'): string {
  let h: number;
  if (ap === 'AM') {
    h = h12 === 12 ? 0 : h12;
  } else {
    h = h12 === 12 ? 12 : h12 + 12;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Extra right padding so the native select chevron does not cover digits (esp. on narrow flex rows). */
const timeSelectClass =
  'box-border min-h-[50px] w-full min-w-0 pl-3 pr-10 py-3 border border-gray-300 rounded-lg bg-white text-[16px] font-medium tabular-nums text-gray-900 text-center sm:text-left focus:outline-none focus:ring-2 focus:ring-[#00A8A3]';

export const MeetupSchedule: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [place, setPlace] = useState('');
  const [date, setDate] = useState('');
  const [hour12, setHour12] = useState<number | ''>('');
  const [minute, setMinute] = useState<number | ''>('');
  const [ampm, setAmpm] = useState<'AM' | 'PM' | ''>('');
  const [productTitle, setProductTitle] = useState('');
  const [hasExistingMeetup, setHasExistingMeetup] = useState(false);

  const time = useMemo(() => {
    if (hour12 === '' || minute === '' || ampm === '') return '';
    return partsToTime24(hour12, minute, ampm);
  }, [hour12, minute, ampm]);

  useEffect(() => {
    if (orderId) {
      const order = getOrderById(orderId);
      if (order) {
        setProductTitle(order.product.title);
        if (order.meetupPlace) setPlace(order.meetupPlace);
        if (order.meetupDate) setDate(order.meetupDate);
        if (order.meetupTime) {
          const p = time24ToParts(order.meetupTime);
          if (p) {
            setHour12(p.h12);
            setMinute(p.min);
            setAmpm(p.ap);
          } else {
            setHour12('');
            setMinute('');
            setAmpm('');
          }
        } else {
          setHour12('');
          setMinute('');
          setAmpm('');
        }
        setHasExistingMeetup(!!(order.meetupPlace || order.meetupDate || order.meetupTime));
      }
    }
  }, [orderId]);

  const minDateStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async () => {
    if (!place || !date || !time || !orderId) {
      alert('Please fill in all fields.');
      return;
    }

    if (!DATE_PATTERN.test(date.trim())) {
      alert('Date must be YYYY-MM-DD (e.g. 2026-03-17).');
      return;
    }
    if (!TIME_PATTERN.test(time.trim())) {
      alert('Time must be 24-hour HH:MM (e.g. 14:30).');
      return;
    }

    if (date.trim() < minDateStr) {
      alert('Date cannot be in the past.');
      return;
    }

    const normalizedTime = (() => {
      const [h, m] = time.trim().split(':');
      return `${h.padStart(2, '0')}:${m}`;
    })();

    const orderBefore = getOrderById(orderId);
    const wasEdit = !!(orderBefore?.meetupPlace || orderBefore?.meetupDate || orderBefore?.meetupTime);

    const updatedOrder = updateOrderMeetup(orderId, {
      meetupPlace: place,
      meetupDate: date.trim(),
      meetupTime: normalizedTime,
    });
    if (updatedOrder) {
      api.put(`/api/orders/${orderId}`, { status: updatedOrder.status, meetup_place: place, meetup_date: date.trim(), meetup_time: normalizedTime }).catch(e => console.error('DB meetup sync fail', e));
      if (wasEdit) {
        addMeetupUpdatedToChat(updatedOrder);
      } else {
        addMeetupConfirmedToChat(updatedOrder);
      }
      const currentUserId = getCurrentUserId();
      const isSeller = currentUserId === updatedOrder.seller.id;
      const otherUser = isSeller ? updatedOrder.buyer : updatedOrder.seller;
      addNotification({
        targetUserId: otherUser.id,
        type: 'order',
        title: wasEdit ? NOTIFY_MEETUP_UPDATED : NOTIFY_MEETUP_CONFIRMED,
        content: wasEdit
          ? `Meetup for "${updatedOrder.product.title}" was updated: ${place}, ${date.trim()} ${normalizedTime}`
          : `Meetup for "${updatedOrder.product.title}" is set: ${place}, ${date.trim()} ${normalizedTime}`,
        link: `/order/${orderId}`,
      });
      alert(
        wasEdit
          ? 'Meetup updated. It is reflected in chat.'
          : 'Meetup confirmed. Your partner has been notified.'
      );
    }
    navigate(-1);
  };

  const handleCancelMeetup = () => {
    if (!orderId) return;
    const orderBefore = getOrderById(orderId);
    if (!orderBefore) return;
    if (!confirm('Cancel this meetup? The other person will be notified.')) return;
    const cancelled = cancelOrderMeetup(orderId);
    if (cancelled) {
      addMeetupCancelledToChat(orderBefore);
      const currentUserId = getCurrentUserId();
      const otherUser = currentUserId === orderBefore.seller.id ? orderBefore.buyer : orderBefore.seller;
      addNotification({
        targetUserId: otherUser.id,
        type: 'order',
        title: NOTIFY_MEETUP_CANCELED,
        content: `The meetup for "${orderBefore.product.title}" was canceled.`,
        link: `/chat`,
      });
      alert('Meetup canceled.');
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24" lang="en-US">
      <TopBar
        leftContent={
          <button onClick={() => navigate(-1)} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
        title={hasExistingMeetup ? 'Edit meetup' : 'Schedule meetup'}
      />

      <div className="px-4 py-6 pb-24 space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Listing</h3>
          <p className="text-sm text-gray-900">{productTitle || 'Loading…'}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meetup place <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder="e.g. Exit 1, Gangnam Station"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="meetup-date-picker">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative h-[50px] rounded-lg focus-within:ring-2 focus-within:ring-[#00A8A3] focus-within:ring-offset-0">
              <div
                className="absolute inset-0 flex items-center justify-between gap-2 px-4 border border-gray-300 rounded-lg bg-white pointer-events-none text-[16px]"
                aria-hidden
              >
                <span className={date ? 'text-gray-900' : 'text-gray-400'}>{date || 'YYYY-MM-DD'}</span>
                <CalendarGlyph className="text-gray-400 flex-shrink-0" />
              </div>
              <input
                id="meetup-date-picker"
                type="date"
                lang="en-US"
                min={minDateStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Tap to open calendar · today or later</p>
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2" id="meetup-time-label">
              Time <span className="text-red-500">*</span>
            </span>
            <div
              className="grid w-full gap-2 sm:gap-3 [grid-template-columns:minmax(5.25rem,1fr)_minmax(5.25rem,1fr)_minmax(4.75rem,1fr)]"
              role="group"
              aria-labelledby="meetup-time-label"
            >
              <select
                aria-label="Hour"
                className={timeSelectClass}
                value={hour12 === '' ? '' : String(hour12)}
                onChange={(e) => setHour12(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Hour</option>
                {HOURS_12.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <select
                aria-label="Minute"
                className={timeSelectClass}
                value={minute === '' ? '' : String(minute)}
                onChange={(e) => setMinute(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Min</option>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <select
                aria-label="AM or PM"
                className={timeSelectClass}
                value={ampm}
                onChange={(e) => setAmpm(e.target.value === '' ? '' : (e.target.value as 'AM' | 'PM'))}
              >
                <option value="">AM/PM</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {time ? `Stored as ${time} (24h)` : 'Choose hour, minute, and AM or PM (English labels)'}
            </p>
          </div>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡{' '}
            {hasExistingMeetup
              ? 'Saving will notify the other person.'
              : 'Confirming will notify the other person.'}{' '}
            Double-check the time and place.
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 space-y-2">
        <button
          onClick={handleSubmit}
          disabled={!place || !date || !time}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {hasExistingMeetup ? 'Save changes' : 'Confirm meetup'}
        </button>
        {hasExistingMeetup && (
          <button
            type="button"
            onClick={handleCancelMeetup}
            className="w-full px-4 py-3 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50"
          >
            Cancel meetup
          </button>
        )}
      </div>
    </div>
  );
};
