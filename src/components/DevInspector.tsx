import { useEffect, useRef, useState } from "react";
import { Bug, Crosshair, Eye, EyeOff, X, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type InspectorInfo = {
  tag: string;
  id: string;
  classes: string;
  selector: string;
  text: string;
  width: number;
  height: number;
  x: number;
  y: number;
};

const ENABLED_KEY = "dev-inspector-enabled";
const SHOW_KEY = "dev-inspector-show";

function readFlag(key: string, defaultValue = false) {
  try {
    const v = localStorage.getItem(key);
    if (v === "on") return true;
    if (v === "off") return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function buildSelectorPath(el: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = el;

  while (node && node.nodeType === 1 && parts.length < 6) {
    if (node.id) {
      parts.unshift(`#${node.id}`);
      break;
    }

    const tag = node.tagName.toLowerCase();
    const className = (node.className || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join("");

    const parent = node.parentElement;
    if (!parent) {
      parts.unshift(`${tag}${className}`);
      break;
    }

    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === node!.tagName
    );
    const idx = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : "";
    parts.unshift(`${tag}${className}${idx}`);
    node = parent;
  }

  return parts.join(" > ");
}

function isInspectorElement(el: HTMLElement | null) {
  return !!el?.closest('[data-dev-inspector="true"]');
}

export function DevInspector() {
  // ✅ يظهر فقط في بيئة التطوير المحلية — لا يعمل على الرابط المنشور
  const isLocalDev = typeof window !== "undefined" && (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168.")
  );
  
  // ✅ على localhost: مفعّل دائماً تلقائياً — لا يحتاج تفعيل يدوي
  // على الموقع المنشور: لا يعمل أبداً
  const [enabled, setEnabled] = useState(isLocalDev);
  const [showFloatingButton, setShowFloatingButton] = useState(isLocalDev);
  const [inspectMode, setInspectMode] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<InspectorInfo | null>(null);
  const prevTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(ENABLED_KEY, enabled ? "on" : "off");
    } catch {
      // no-op
    }
  }, [enabled]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_KEY, showFloatingButton ? "on" : "off");
    } catch {
      // no-op
    }
  }, [showFloatingButton]);

  useEffect(() => {
    const onToggle = (evt: Event) => {
      const custom = evt as CustomEvent<{ enabled?: boolean }>;
      const next = custom.detail?.enabled;
      if (typeof next === "boolean") {
        setEnabled(next);
        if (!next) setInspectMode(false);
      }
    };

    const onShowToggle = (evt: Event) => {
      const custom = evt as CustomEvent<{ show?: boolean }>;
      const next = custom.detail?.show;
      if (typeof next === "boolean") {
        setShowFloatingButton(next);
      }
    };

    window.addEventListener("devInspectorToggle", onToggle);
    window.addEventListener("devInspectorShowToggle", onShowToggle);
    return () => {
      window.removeEventListener("devInspectorToggle", onToggle);
      window.removeEventListener("devInspectorShowToggle", onShowToggle);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dev-inspector-active", inspectMode);
    return () => document.body.classList.remove("dev-inspector-active");
  }, [inspectMode]);

  useEffect(() => {
    const styleId = "dev-inspector-style";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      ".dev-inspector-hovered { outline: 2px solid #22d3ee !important; outline-offset: 1px !important; }",
      ".dev-inspector-active { cursor: crosshair !important; }",
    ].join("\n");
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    if (prevTargetRef.current && prevTargetRef.current !== target) {
      prevTargetRef.current.classList.remove("dev-inspector-hovered");
    }

    if (enabled && inspectMode && target) {
      target.classList.add("dev-inspector-hovered");
      prevTargetRef.current = target;
    }

    return () => {
      if (!enabled || !inspectMode) {
        if (prevTargetRef.current) {
          prevTargetRef.current.classList.remove("dev-inspector-hovered");
          prevTargetRef.current = null;
        }
      }
    };
  }, [enabled, inspectMode, target]);

  useEffect(() => {
    if (!enabled || !inspectMode) return;

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!el || isInspectorElement(el)) return;
      setTarget(el);
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || isInspectorElement(el)) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      setSelected({
        tag: el.tagName.toLowerCase(),
        id: el.id || "-",
        classes: el.className || "-",
        selector: buildSelectorPath(el),
        text: (el.textContent || "").trim().slice(0, 120) || "-",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectMode(false);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, inspectMode]);

  if (!showFloatingButton && !inspectMode && !selected) return null;

  return (
    <>
      {enabled && showFloatingButton && (
        <div
          data-dev-inspector="true"
          className="fixed bottom-4 left-4 z-[99999]"
          dir="rtl"
        >
          <Button
            type="button"
            size="sm"
            variant={inspectMode ? "destructive" : "secondary"}
            className="rounded-full shadow-lg"
            onClick={() => setInspectMode((v) => !v)}
          >
            <Bug className="w-4 h-4 ml-1" />
            {inspectMode ? "إيقاف الفحص" : "فحص الواجهة"}
          </Button>
        </div>
      )}

      {selected && (
        <div
          data-dev-inspector="true"
          dir="rtl"
          className="fixed top-4 left-4 z-[99999] w-[min(92vw,440px)] rounded-xl border bg-background shadow-2xl"
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-semibold">تفاصيل العنصر</div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => setInspectMode((v) => !v)}>
                {inspectMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setSelected(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2 px-3 py-3 text-xs">
            <div><span className="font-semibold">Tag:</span> {selected.tag}</div>
            <div><span className="font-semibold">ID:</span> {selected.id}</div>
            <div className="break-all"><span className="font-semibold">Classes:</span> {selected.classes}</div>
            <div className="break-all"><span className="font-semibold">Selector:</span> {selected.selector}</div>
            <div><span className="font-semibold">Size:</span> {selected.width} x {selected.height}</div>
            <div><span className="font-semibold">Position:</span> {selected.x}, {selected.y}</div>
            <div className="line-clamp-2"><span className="font-semibold">Text:</span> {selected.text}</div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(selected.selector);
                } catch {
                  // no-op
                }
              }}
            >
              <Copy className="w-4 h-4 ml-1" />
              نسخ Selector
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setInspectMode(true)}>
              <Crosshair className="w-4 h-4 ml-1" />
              متابعة الفحص
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default DevInspector;