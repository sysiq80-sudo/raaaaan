import { useCallback, useEffect, useRef, useState } from 'react';
import '@/styles/dev-inspector.css';
import * as Sentry from "@sentry/react";

interface ElementInfo {
  element: HTMLElement;
  componentName: string | null;
  filePath: string | null;
  elementType: string;
  elementTypeAr: string;
  label: string;
  selector: string;
  mapIds: MapIdInfo[];
  rect: DOMRect;
}

interface MapIdInfo {
  id: string;
  type: 'page' | 'zone' | 'component' | 'anchor';
  label: string;
}

interface PanelPosition {
  x: number;
  y: number;
}

const TYPE_LABELS: Record<string, string> = {
  page: 'Page',
  zone: 'Zone',
  component: 'Component',
  anchor: 'Anchor Point',
};

const ELEMENT_TYPE_AR: Record<string, string> = {
  button: 'زر',
  link: 'رابط',
  input: 'حقل إدخال',
  textarea: 'منطقة نص',
  select: 'قائمة منسدلة',
  checkbox: 'مربع اختيار',
  radio: 'زر راديو',
  switch: 'مفتاح تبديل',
  image: 'صورة',
  icon: 'أيقونة',
  card: 'بطاقة',
  text: 'نص',
  heading: 'عنوان',
  list: 'قائمة',
  listItem: 'عنصر قائمة',
  nav: 'قائمة تنقل',
  sidebar: 'شريط جانبي',
  header: 'ترويسة',
  footer: 'تذييل',
  section: 'قسم',
  form: 'نموذج',
  table: 'جدول',
  dialog: 'نافذة حوار',
  badge: 'شارة',
  avatar: 'صورة شخصية',
  tab: 'تبويب',
  dropdown: 'قائمة منسدلة',
  container: 'حاوية',
  unknown: 'عنصر',
};

const SEMANTIC_CONTAINERS = new Set([
  'nav', 'aside', 'main', 'section', 'article', 'form',
  'header', 'footer', 'ul', 'ol', 'table', 'dialog',
]);

function setCssVar(element: HTMLElement | null, name: string, value: string) {
  if (element) element.style.setProperty(name, value);
}

function getMapIdType(id: string): MapIdInfo['type'] {
  if (id.startsWith('P-')) return 'page';
  if (id.startsWith('Z-')) return 'zone';
  if (id.startsWith('C-')) return 'component';
  if (id.startsWith('AP-')) return 'anchor';
  return 'component';
}

function collectMapIds(element: HTMLElement): MapIdInfo[] {
  const ids: MapIdInfo[] = [];
  let current: HTMLElement | null = element;

  while (current) {
    const mapId = current.getAttribute('data-map-id');
    if (mapId) {
      const type = getMapIdType(mapId);
      ids.push({ id: mapId, type, label: TYPE_LABELS[type] });
    }
    current = current.parentElement;
  }

  return ids.reverse();
}

function getReactFiber(node: HTMLElement): unknown {
  const key = Object.keys(node).find((entry) => entry.startsWith('__reactFiber$'));
  return key ? ((node as unknown as Record<string, unknown>)[key]) : null;
}

function getComponentInfo(element: HTMLElement): { name: string | null; filePath: string | null } {
  let fiber = getReactFiber(element) as {
    type?: { displayName?: string; name?: string };
    _debugSource?: { fileName?: string };
    _debugOwner?: { _debugSource?: { fileName?: string } };
    return?: unknown;
  } | null;
  let currentElement: HTMLElement | null = element;

  while (!fiber && currentElement?.parentElement) {
    currentElement = currentElement.parentElement;
    fiber = getReactFiber(currentElement) as typeof fiber;
  }

  let name: string | null = null;
  let filePath: string | null = null;

  while (fiber) {
    const fiberName = fiber.type?.displayName || fiber.type?.name;
    if (fiberName && typeof fiberName === 'string' && /^[A-Z]/.test(fiberName)) {
      if (!name) name = fiberName;
      if (fiber._debugSource) {
        filePath = fiber._debugSource.fileName || null;
        break;
      }
      if (fiber._debugOwner?._debugSource) {
        filePath = fiber._debugOwner._debugSource.fileName || null;
        break;
      }
    }
    fiber = (fiber.return as typeof fiber) || null;
  }

  if (filePath) {
    const unixIndex = filePath.indexOf('src/');
    if (unixIndex !== -1) {
      filePath = filePath.substring(unixIndex);
    } else {
      const windowsIndex = filePath.indexOf('src\\');
      if (windowsIndex !== -1) filePath = filePath.substring(windowsIndex).replace(/\\/g, '/');
    }
  }

  return { name, filePath };
}

function classifyElement(element: HTMLElement): { type: string; typeAr: string } {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  const className = typeof element.className === 'string' ? element.className : '';

  if (tag === 'button' || role === 'button' || element.getAttribute('type') === 'submit') return { type: 'button', typeAr: ELEMENT_TYPE_AR.button };
  if (tag === 'a' || role === 'link') return { type: 'link', typeAr: ELEMENT_TYPE_AR.link };
  if (tag === 'input') {
    const inputType = element.getAttribute('type') || 'text';
    if (inputType === 'checkbox') return { type: 'checkbox', typeAr: ELEMENT_TYPE_AR.checkbox };
    if (inputType === 'radio') return { type: 'radio', typeAr: ELEMENT_TYPE_AR.radio };
    return { type: 'input', typeAr: ELEMENT_TYPE_AR.input };
  }
  if (tag === 'textarea') return { type: 'textarea', typeAr: ELEMENT_TYPE_AR.textarea };
  if (tag === 'select') return { type: 'select', typeAr: ELEMENT_TYPE_AR.select };
  if (role === 'switch' || className.includes('switch')) return { type: 'switch', typeAr: ELEMENT_TYPE_AR.switch };
  if (role === 'tab' || role === 'tablist') return { type: 'tab', typeAr: ELEMENT_TYPE_AR.tab };
  if (tag === 'dialog' || role === 'dialog' || role === 'alertdialog') return { type: 'dialog', typeAr: ELEMENT_TYPE_AR.dialog };
  if (tag === 'img' || tag === 'picture') return { type: 'image', typeAr: ELEMENT_TYPE_AR.image };
  if (tag === 'svg' || className.includes('lucide') || className.includes('icon')) return { type: 'icon', typeAr: ELEMENT_TYPE_AR.icon };
  if (tag === 'nav' || role === 'navigation') return { type: 'nav', typeAr: ELEMENT_TYPE_AR.nav };
  if (className.includes('sidebar') || role === 'complementary') return { type: 'sidebar', typeAr: ELEMENT_TYPE_AR.sidebar };
  if (className.includes('card') || element.getAttribute('data-slot') === 'card') return { type: 'card', typeAr: ELEMENT_TYPE_AR.card };
  if (className.includes('badge')) return { type: 'badge', typeAr: ELEMENT_TYPE_AR.badge };
  if (className.includes('avatar')) return { type: 'avatar', typeAr: ELEMENT_TYPE_AR.avatar };
  if (tag === 'ul' || tag === 'ol') return { type: 'list', typeAr: ELEMENT_TYPE_AR.list };
  if (tag === 'li' || role === 'listitem' || role === 'menuitem') return { type: 'listItem', typeAr: ELEMENT_TYPE_AR.listItem };
  if (/^h[1-6]$/.test(tag)) return { type: 'heading', typeAr: ELEMENT_TYPE_AR.heading };
  if (tag === 'form') return { type: 'form', typeAr: ELEMENT_TYPE_AR.form };
  if (tag === 'table' || role === 'grid' || role === 'table') return { type: 'table', typeAr: ELEMENT_TYPE_AR.table };
  if (tag === 'header') return { type: 'header', typeAr: ELEMENT_TYPE_AR.header };
  if (tag === 'footer') return { type: 'footer', typeAr: ELEMENT_TYPE_AR.footer };
  if (tag === 'section' || tag === 'article') return { type: 'section', typeAr: ELEMENT_TYPE_AR.section };
  if (role === 'menu' || role === 'listbox') return { type: 'dropdown', typeAr: ELEMENT_TYPE_AR.dropdown };
  if ((tag === 'p' || tag === 'span' || tag === 'label') && element.textContent?.trim()) return { type: 'text', typeAr: ELEMENT_TYPE_AR.text };
  if (tag === 'div' || tag === 'main' || tag === 'aside') return { type: 'container', typeAr: ELEMENT_TYPE_AR.container };

  return { type: 'unknown', typeAr: ELEMENT_TYPE_AR.unknown };
}

function getElementLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const title = element.getAttribute('title');
  if (title) return title;

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) return placeholder;

  const alt = element.getAttribute('alt');
  if (alt) return alt;

  const text = element.textContent?.trim();
  if (text && text.length <= 50) return text;
  if (text && text.length > 50) return `${text.substring(0, 47)}...`;
  return '';
}

function getElementSelector(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const classes = typeof element.className === 'string'
    ? element.className.split(/\s+/).filter((entry) => entry && entry.length < 30).slice(0, 2).map((entry) => `.${entry}`).join('')
    : '';
  return `${tag}${id}${classes}`;
}

function analyzeElement(element: HTMLElement): ElementInfo {
  const { type, typeAr } = classifyElement(element);
  const { name: componentName, filePath } = getComponentInfo(element);
  return {
    element,
    componentName,
    filePath,
    elementType: type,
    elementTypeAr: typeAr,
    label: getElementLabel(element),
    selector: getElementSelector(element),
    mapIds: collectMapIds(element),
    rect: element.getBoundingClientRect(),
  };
}

function findSemanticContainer(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const tag = current.tagName.toLowerCase();
    const role = current.getAttribute('role');
    const className = typeof current.className === 'string' ? current.className : '';

    if (SEMANTIC_CONTAINERS.has(tag)) return current;
    if (role === 'navigation' || role === 'complementary' || role === 'dialog' || role === 'group') return current;
    if (className.includes('card') || className.includes('sidebar') || className.includes('panel') || className.includes('toolbar')) return current;
    if (current.getAttribute('data-map-id')) return current;
    current = current.parentElement;
  }
  return null;
}

function getElementAtDepth(base: HTMLElement, offset: number): HTMLElement {
  if (offset <= 0) return base;

  let current: HTMLElement | null = base;
  for (let index = 0; index < offset; index += 1) {
    if (current?.parentElement) current = current.parentElement;
    else break;
  }
  return current || base;
}

function generatePromptText(info: ElementInfo, isGroup: boolean): string {
  const file = info.filePath ? info.filePath.split('/').pop() : null;
  const parts: string[] = [];

  if (file) parts.push(`في ملف ${file}`);
  if (info.componentName) parts.push(`الكومبوننت ${info.componentName}`);

  if (isGroup) {
    const childCount = info.element.querySelectorAll('*').length;
    parts.push(`${info.elementTypeAr} "${info.label}" (${info.selector}) — تحتوي ${childCount} عنصر`);
  } else {
    parts.push(info.label ? `${info.elementTypeAr} "${info.label}" (${info.selector})` : `${info.elementTypeAr} (${info.selector})`);
  }

  if (info.mapIds.length > 0) {
    parts.push(`Map: ${info.mapIds.map((entry) => `[${entry.id}]`).join(' > ')}`);
  }

  return parts.join('، ');
}

function isInspectorElement(element: HTMLElement | null): boolean {
  let current = element;
  while (current) {
    if (current.getAttribute('data-dev-inspector') === 'true') return true;
    if (current.getAttribute('data-visual-editor') === 'true') return true;
    current = current.parentElement;
  }
  return false;
}

function useDraggable(initialPosition: PanelPosition) {
  const [position, setPosition] = useState<PanelPosition>(initialPosition);
  const dragging = useRef(false);
  const startOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true;
    startOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y };
    event.preventDefault();
  }, [position]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging.current) return;
      setPosition({ x: event.clientX - startOffset.current.x, y: event.clientY - startOffset.current.y });
    };

    const onUp = () => {
      dragging.current = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return { position, setPosition, onMouseDown };
}

function InfoRow({ icon, label, value, mono = false }: { icon: string; label: string; value: string; mono?: boolean }) {
  return (
    <div className="dev-inspector-info-row">
      <span className="dev-inspector-info-icon">{icon}</span>
      <span className="dev-inspector-info-label">{label}</span>
      <span className={`dev-inspector-info-value${mono ? ' is-mono' : ''}`}>{value}</span>
    </div>
  );
}

function DevInspectorInner() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('dev-inspector-enabled') === 'on';
    } catch {
      return false;
    }
  });
  const [showFloatingButton, setShowFloatingButton] = useState(true); // يظهر دائماً في DEV
  const [hoveredInfo, setHoveredInfo] = useState<ElementInfo | null>(null);
  const [selectedInfo, setSelectedInfo] = useState<ElementInfo | null>(null);
  const [isGroupSelection, setIsGroupSelection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [depthOffset, setDepthOffset] = useState(0);

  const { position: panelPosition, setPosition: setPanelPosition, onMouseDown: onPanelDragStart } = useDraggable({
    x: typeof window !== 'undefined' ? window.innerWidth - 386 : 16,
    y: typeof window !== 'undefined' ? window.innerHeight - 340 : 16,
  });

  const buttonStorageKey = 'dev-inspector-btn-pos';
  const getInitialButtonPosition = () => {
    if (typeof window === 'undefined') return { x: 16, y: 16 };
    try {
      const saved = localStorage.getItem(buttonStorageKey);
      if (saved) return JSON.parse(saved) as { x: number; y: number };
    } catch {
      // ignore invalid storage
    }
    return { x: 16, y: window.innerHeight - 56 };
  };

  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number }>(getInitialButtonPosition);
  const buttonDragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const isButtonDragging = useRef(false);
  const baseHoveredRef = useRef<HTMLElement | null>(null);
  const lastTargetRef = useRef<HTMLElement | null>(null);
  const hoveredInfoRef = useRef<ElementInfo | null>(null);
  const floatingButtonRef = useRef<HTMLDivElement | null>(null);
  const hoverOverlayRef = useRef<HTMLDivElement | null>(null);
  const selectedOverlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  hoveredInfoRef.current = hoveredInfo;

  useEffect(() => {
    setCssVar(floatingButtonRef.current, '--dev-inspector-btn-x', `${buttonPosition.x}px`);
    setCssVar(floatingButtonRef.current, '--dev-inspector-btn-y', `${buttonPosition.y}px`);
  }, [buttonPosition]);

  useEffect(() => {
    if (!hoverOverlayRef.current || !hoveredInfo || selectedInfo) return;
    const rect = hoveredInfo.rect;
    setCssVar(hoverOverlayRef.current, '--dev-inspector-top', `${rect.top - 2}px`);
    setCssVar(hoverOverlayRef.current, '--dev-inspector-left', `${rect.left - 2}px`);
    setCssVar(hoverOverlayRef.current, '--dev-inspector-width', `${rect.width + 4}px`);
    setCssVar(hoverOverlayRef.current, '--dev-inspector-height', `${rect.height + 4}px`);
  }, [hoveredInfo, selectedInfo]);

  useEffect(() => {
    if (!selectedOverlayRef.current || !selectedInfo) return;
    const rect = selectedInfo.element.getBoundingClientRect();
    setCssVar(selectedOverlayRef.current, '--dev-inspector-top', `${rect.top - 3}px`);
    setCssVar(selectedOverlayRef.current, '--dev-inspector-left', `${rect.left - 3}px`);
    setCssVar(selectedOverlayRef.current, '--dev-inspector-width', `${rect.width + 6}px`);
    setCssVar(selectedOverlayRef.current, '--dev-inspector-height', `${rect.height + 6}px`);
  }, [selectedInfo]);

  useEffect(() => {
    setCssVar(panelRef.current, '--dev-inspector-panel-x', `${panelPosition.x}px`);
    setCssVar(panelRef.current, '--dev-inspector-panel-y', `${panelPosition.y}px`);
  }, [panelPosition]);

  useEffect(() => {
    try {
      localStorage.setItem('dev-inspector-enabled', enabled ? 'on' : 'off');
    } catch {
      // noop
    }
  }, [enabled]);

  // showFloatingButton دائماً true في DEV — لا نحفظه

  useEffect(() => {
    const onToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      setEnabled(detail?.enabled ?? false);
    };

    window.addEventListener('devInspectorToggle', onToggle);
    return () => window.removeEventListener('devInspectorToggle', onToggle);
  }, []);

  useEffect(() => {
    const onShowToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ show?: boolean }>).detail;
      setShowFloatingButton(detail?.show ?? false);
    };

    window.addEventListener('devInspectorShowToggle', onShowToggle);
    return () => window.removeEventListener('devInspectorShowToggle', onShowToggle);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setEnabled((previous) => !previous);
        setSelectedInfo(null);
        setHoveredInfo(null);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!selectedInfo) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedInfo(null);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedInfo]);

  useEffect(() => {
    if (!enabled) {
      setSelectedInfo(null);
      setHoveredInfo(null);
      setDepthOffset(0);
      baseHoveredRef.current = null;
      lastTargetRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    const style = document.createElement('style');
    style.setAttribute('data-dev-inspector-runtime', 'true');
    style.textContent = [
      '.dev-inspector-active [data-dev-inspector="true"] { cursor: default !important; }',
      '.dev-inspector-active [data-dev-inspector="true"] button { cursor: pointer !important; }',
    ].join('\n');

    document.head.appendChild(style);
    document.body.classList.add('dev-inspector-active');

    return () => {
      document.body.classList.remove('dev-inspector-active');
      style.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !baseHoveredRef.current) return;
    const element = getElementAtDepth(baseHoveredRef.current, depthOffset);
    setHoveredInfo(analyzeElement(element));
  }, [depthOffset, enabled]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled) return;
    const target = event.target as HTMLElement;
    if (isInspectorElement(target)) {
      setHoveredInfo(null);
      baseHoveredRef.current = null;
      lastTargetRef.current = null;
      return;
    }

    if (target !== lastTargetRef.current) {
      lastTargetRef.current = target;
      baseHoveredRef.current = target;
      setDepthOffset(0);
      setHoveredInfo(analyzeElement(target));
    }
  }, [enabled]);

  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    const target = event.target as HTMLElement;
    if (isInspectorElement(target)) return;

    event.preventDefault();
    event.stopPropagation();

    let elementToSelect = hoveredInfoRef.current?.element || target;

    if (event.shiftKey) {
      const container = findSemanticContainer(elementToSelect);
      if (container) elementToSelect = container;
      setIsGroupSelection(true);
    } else {
      setIsGroupSelection(false);
    }

    const info = analyzeElement(elementToSelect);
    setSelectedInfo(info);
    setCopied(false);

    if (typeof window !== 'undefined') {
      const panelWidth = 370;
      const panelHeight = 320;
      let panelX = event.clientX + 12;
      let panelY = event.clientY + 12;

      if (panelX + panelWidth > window.innerWidth - 10) panelX = event.clientX - panelWidth - 12;
      if (panelY + panelHeight > window.innerHeight - 10) panelY = event.clientY - panelHeight - 12;

      setPanelPosition({ x: Math.max(4, panelX), y: Math.max(4, panelY) });
    }
  }, [enabled, setPanelPosition]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enabled || !baseHoveredRef.current) return;
    if (!event.altKey) return;
    if (isInspectorElement(event.target as HTMLElement)) return;
    event.preventDefault();
    setDepthOffset((previous) => Math.max(0, previous + (event.deltaY < 0 ? 1 : -1)));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('wheel', handleWheel, true);
    };
  }, [enabled, handleMouseMove, handleContextMenu, handleWheel]);

  const handleCopy = useCallback(async () => {
    if (!selectedInfo) return;

    const text = generatePromptText(selectedInfo, isGroupSelection);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.className = 'dev-inspector-copy-buffer';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      setCopyError(null);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy prompt failed', error);
      setCopyError('فشل النسخ');
      setTimeout(() => setCopyError(null), 2000);
    }
  }, [selectedInfo, isGroupSelection]);

  const floatingLabel = hoveredInfo
    ? `${hoveredInfo.componentName || '?'} › ${hoveredInfo.elementTypeAr}${hoveredInfo.label ? ` "${hoveredInfo.label.substring(0, 25)}"` : ''}`
    : '';
  const depthIndicator = depthOffset > 0 ? ` ↑${depthOffset}` : '';
  const panelClassName = `dev-inspector-panel${isGroupSelection ? ' is-group' : ''}`;
  const buttonClassName = `dev-inspector-floating-button${enabled ? ' is-enabled' : ''}`;
  const selectedClassName = `dev-inspector-selected-overlay${isGroupSelection ? ' is-group' : ''}`;

  const onButtonPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    isButtonDragging.current = false;
    buttonDragRef.current = { sx: event.clientX, sy: event.clientY, ox: buttonPosition.x, oy: buttonPosition.y };
  };

  const onButtonPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!buttonDragRef.current || typeof window === 'undefined') return;

    const dx = event.clientX - buttonDragRef.current.sx;
    const dy = event.clientY - buttonDragRef.current.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) isButtonDragging.current = true;
    if (!isButtonDragging.current) return;

    const nextX = Math.max(4, Math.min(window.innerWidth - 44, buttonDragRef.current.ox + dx));
    const nextY = Math.max(4, Math.min(window.innerHeight - 44, buttonDragRef.current.oy + dy));
    setButtonPosition({ x: nextX, y: nextY });
  };

  const onButtonPointerUp = () => {
    if (isButtonDragging.current) {
      try {
        localStorage.setItem(buttonStorageKey, JSON.stringify(buttonPosition));
      } catch {
        // ignore storage errors
      }
    }
    buttonDragRef.current = null;
    isButtonDragging.current = false;
  };

  return (
    <>
      {showFloatingButton && (
        <div
          ref={floatingButtonRef}
          data-dev-inspector="true"
          title={enabled ? 'إيقاف خريطة المكونات (Ctrl+Shift+D)' : 'تفعيل خريطة المكونات (Ctrl+Shift+D)'}
          className={buttonClassName}
          onClick={() => {
            if (isButtonDragging.current) return;
            setEnabled((previous) => !previous);
            setSelectedInfo(null);
            setHoveredInfo(null);
          }}
          onPointerDown={onButtonPointerDown}
          onPointerMove={onButtonPointerMove}
          onPointerUp={onButtonPointerUp}
        >
          🗺️
        </div>
      )}

      {enabled && hoveredInfo && !selectedInfo && (
        <div ref={hoverOverlayRef} data-dev-inspector="true" className="dev-inspector-hover-overlay">
          <span className="dev-inspector-hover-label">{floatingLabel}{depthIndicator}</span>
          <span className="dev-inspector-hover-size">{Math.round(hoveredInfo.rect.width)}×{Math.round(hoveredInfo.rect.height)}</span>
        </div>
      )}

      {enabled && selectedInfo && (
        <div ref={selectedOverlayRef} data-dev-inspector="true" className={selectedClassName} />
      )}

      {selectedInfo && (
        <div ref={panelRef} data-dev-inspector="true" className={panelClassName}>
          <div onMouseDown={onPanelDragStart} className="dev-inspector-panel-header">
            <span className="dev-inspector-panel-title">
              🔍 {isGroupSelection ? 'Group Inspector' : 'Element Inspector'}
              <span className="dev-inspector-panel-drag-hint">⠿ drag</span>
            </span>
            <button data-dev-inspector="true" className="dev-inspector-close-button" onClick={() => setSelectedInfo(null)}>
              ✕
            </button>
          </div>

          <div className="dev-inspector-panel-body">
            {selectedInfo.filePath && <InfoRow icon="📁" label="File" value={selectedInfo.filePath} mono />}
            {selectedInfo.componentName && <InfoRow icon="🧩" label="Component" value={selectedInfo.componentName} />}
            <InfoRow icon="🏷️" label="Element" value={`${selectedInfo.elementTypeAr}${selectedInfo.label ? ` — "${selectedInfo.label}"` : ''}`} />
            <InfoRow icon="📐" label="Size" value={`${Math.round(selectedInfo.rect.width)}×${Math.round(selectedInfo.rect.height)}px`} />
            <InfoRow icon="🎯" label="Selector" value={selectedInfo.selector} mono />
            {selectedInfo.mapIds.length > 0 && <InfoRow icon="🗺️" label="Map" value={selectedInfo.mapIds.map((entry) => `[${entry.id}]`).join(' > ')} mono />}
            {isGroupSelection && <InfoRow icon="📦" label="Children" value={`${selectedInfo.element.querySelectorAll('*').length} عنصر`} />}
          </div>

          <div className="dev-inspector-panel-actions">
            <button data-dev-inspector="true" className={`dev-inspector-copy-button${copied ? ' is-copied' : ''}`} onClick={handleCopy}>
              {copied ? '✅ تم النسخ!' : '📋 نسخ للبرومبت'}
            </button>
            <button 
              data-dev-inspector="true" 
              className="dev-inspector-sentry-button"
              onClick={() => {
                try {
                  throw new Error('Sentry Test Error - هذا خطأ تجريبي من DevInspector');
                } catch (error) {
                  console.error('Sentry Test Error:', error);
                  alert('تم إرسال خطأ تجريبي إلى Sentry! تحقق من لوحة التحكم.');
                }
              }}
            >
              🐛 اختبار Sentry
            </button>
            {copyError && <div className="dev-inspector-copy-error">{copyError}</div>}
          </div>

          <div className="dev-inspector-panel-footer">
            <p className="dev-inspector-hint">Right Click = inspect · Shift+RClick = group · Alt+Scroll = depth · Esc = close</p>
          </div>
        </div>
      )}
    </>
  );
}

/** يظهر فقط في بيئة التطوير المحلية — لا يُشغَّل في الإنتاج */
export function DevInspector() {
  if (!import.meta.env.DEV) return null;
  return <DevInspectorInner />;
}

export default DevInspector;
