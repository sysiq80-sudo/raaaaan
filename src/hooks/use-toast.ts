import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;
const DEFAULT_TOAST_DURATION = 3000; // 3 seconds

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
  | {
      type: ActionType["ADD_TOAST"];
      toast: ToasterToast;
    }
  | {
      type: ActionType["UPDATE_TOAST"];
      toast: Partial<ToasterToast>;
    }
  | {
      type: ActionType["DISMISS_TOAST"];
      toastId?: ToasterToast["id"];
    }
  | {
      type: ActionType["REMOVE_TOAST"];
      toastId?: ToasterToast["id"];
    };

interface State {
  toasts: ToasterToast[];
}

// Existing remove queue timeouts (used to finally remove dismissed toasts)
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
// Auto-dismiss timeouts (3s default) and durations tracking
const autoDismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const autoDismissDurations = new Map<string, number>();

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
};

const isConnectionToastText = (node: React.ReactNode): boolean => {
  if (!node) return false;
  if (typeof node === "string") {
    return (
      node.includes("تم استعادة حالة الاتصال") ||
      node.includes("أنت متصل ويمكنك استقبال") ||
      node.includes("أنت متصل الآن") ||
      node.includes("تم قطع الاتصال") ||
      node.includes("تم استعادة الاتصال") ||
      node.includes("لا يوجد اتصال بالإنترنت")
    );
  }
  if (Array.isArray(node)) {
    return node.some(isConnectionToastText);
  }
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as any).props;
    return props && props.children ? isConnectionToastText(props.children) : false;
  }
  return false;
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      if (
        isConnectionToastText(action.toast.title) ||
        isConnectionToastText(action.toast.description)
      ) {
        return state;
      }
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };

    case "DISMISS_TOAST": {
      const { toastId } = action;

      // Schedule removal (keeps the slide-out animation)
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      // Clear any auto-dismiss timer
      if (toastId && autoDismissTimeouts.has(toastId)) {
        clearTimeout(autoDismissTimeouts.get(toastId));
        autoDismissTimeouts.delete(toastId);
        autoDismissDurations.delete(toastId);
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t,
        ),
      };
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        // Clear all auto-dismiss timers
        autoDismissTimeouts.forEach((to) => clearTimeout(to));
        autoDismissTimeouts.clear();
        autoDismissDurations.clear();

        return {
          ...state,
          toasts: [],
        };
      }

      // Clear single auto-dismiss timer
      if (action.toastId && autoDismissTimeouts.has(action.toastId)) {
        clearTimeout(autoDismissTimeouts.get(action.toastId));
        autoDismissTimeouts.delete(action.toastId);
        autoDismissDurations.delete(action.toastId);
      }

      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

type Toast = Omit<ToasterToast, "id">;

function toast({ ...props }: Toast) {
  const id = genId();

  // default duration 3s unless provided
  const duration = typeof props.duration === 'number' ? props.duration : DEFAULT_TOAST_DURATION;

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    });
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id });

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      duration,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  // schedule auto-dismiss (unless duration === 0)
  if (duration && duration > 0) {
    autoDismissDurations.set(id, duration);
    const to = setTimeout(() => {
      dispatch({ type: "DISMISS_TOAST", toastId: id });
    }, duration);
    autoDismissTimeouts.set(id, to);
  }

  return {
    id: id,
    dismiss,
    update,
  };
}

function pauseAutoDismiss(toastId?: string) {
  if (!toastId) return;
  if (autoDismissTimeouts.has(toastId)) {
    clearTimeout(autoDismissTimeouts.get(toastId));
    autoDismissTimeouts.delete(toastId);
  }
}

function resumeAutoDismiss(toastId?: string) {
  if (!toastId) return;
  if (autoDismissTimeouts.has(toastId)) return; // already running
  const duration = autoDismissDurations.get(toastId) ?? DEFAULT_TOAST_DURATION;
  if (!duration || duration === 0) return;
  const to = setTimeout(() => {
    dispatch({ type: "DISMISS_TOAST", toastId });
  }, duration);
  autoDismissTimeouts.set(toastId, to);
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [state]);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
    pause: (toastId?: string) => pauseAutoDismiss(toastId),
    resume: (toastId?: string) => resumeAutoDismiss(toastId),
  };
}

export { useToast, toast };
