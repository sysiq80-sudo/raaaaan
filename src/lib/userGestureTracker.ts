/**
 * ران — User Gesture Tracker
 *
 * المتصفح يحجب navigator.vibrate قبل أي تفاعل من المستخدم.
 * هذا الملف يتتبع ما إذا كان المستخدم قد تفاعل مع الصفحة.
 *
 * الاستخدام:
 *   initUserGestureTracking();   // في main.tsx
 *   if (hasUserInteracted()) navigator.vibrate([300]);
 */

let _hasInteracted = false;

const GESTURE_EVENTS: (keyof DocumentEventMap)[] = [
  'click',
  'touchstart',
  'keydown',
  'pointerdown',
];

function _onInteraction() {
  if (_hasInteracted) return;
  _hasInteracted = true;
  // تنظيف المستمعين بعد أول تفاعل
  GESTURE_EVENTS.forEach((event) =>
    document.removeEventListener(event, _onInteraction, { capture: true } as EventListenerOptions)
  );
}

/** يجب استدعاؤه مرة واحدة في main.tsx */
export function initUserGestureTracking(): void {
  GESTURE_EVENTS.forEach((event) =>
    document.addEventListener(event, _onInteraction, { once: false, capture: true, passive: true })
  );
}

/** هل تفاعل المستخدم مع الصفحة مسبقاً؟ */
export function hasUserInteracted(): boolean {
  return _hasInteracted;
}

/**
 * نسخة آمنة من navigator.vibrate — تعمل فقط بعد تفاعل المستخدم.
 * تُعيد true إذا اشتغل الاهتزاز، false إذا حُجب.
 */
export function safeVibrate(pattern: number | number[]): boolean {
  if (!_hasInteracted) return false;
  if (!('vibrate' in navigator)) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
