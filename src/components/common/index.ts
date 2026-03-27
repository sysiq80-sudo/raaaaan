/**
 * ران - المكونات المشتركة
 * ملف تصدير مركزي للمكونات الأكثر استخداماً
 */

// UI Components
export { Button } from '@/components/ui/button';
export { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Badge } from '@/components/ui/badge';
export { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
export {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
export {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
export { Skeleton } from '@/components/ui/skeleton';
export { Switch } from '@/components/ui/switch';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Textarea } from '@/components/ui/textarea';
export { ScrollArea } from '@/components/ui/scroll-area';
export { Separator } from '@/components/ui/separator';
export { Progress } from '@/components/ui/progress';

// Toast
export { useToast, toast } from '@/hooks/use-toast';

// Re-export commonly used icons
export {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    Home,
    Loader2,
    LogOut,
    Mail,
    MapPin,
    Menu,
    Phone,
    Plus,
    Search,
    Settings,
    Star,
    User,
    Users,
    Wallet,
    X,
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,
    Navigation,
    Car,
    Zap,
    Shield,
    HeartHandshake,
    Route,
    MapPinned,
    Facebook,
    Twitter,
    Instagram,
    Smartphone,
    Calendar,
    Bell,
    Gift,
    BarChart3,
    Target,
    Locate,
    RefreshCw,
} from 'lucide-react';

// Common Components
export { ErrorFallback, LoadingFallback, EmptyState, NetworkError } from './ErrorFallback';
export { ConnectionStatusBar, ConnectionIndicator, ConnectionBadge } from './ConnectionStatusBar';
export { PWAInstallPrompt, useIsPWAInstalled } from './PWAInstallPrompt';
