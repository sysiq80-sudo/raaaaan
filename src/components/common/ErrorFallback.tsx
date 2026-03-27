/**
 * ران - مكون معالجة الأخطاء المحسّن
 * يعرض رسالة خطأ ودية مع خيارات للمستخدم
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.png';

interface ErrorFallbackProps {
    error?: Error | null;
    resetError?: () => void;
    title?: string;
    description?: string;
    showHomeButton?: boolean;
    showBackButton?: boolean;
    showDetails?: boolean;
    className?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    title = 'حدث خطأ غير متوقع',
    description = 'عذراً، حدث خطأ أثناء عرض هذا القسم. يمكنك المحاولة مرة أخرى.',
    showHomeButton = true,
    showBackButton = true,
    showDetails = process.env.NODE_ENV === 'development',
    className = '',
}) => {
    const navigate = useNavigate();
    const [showError, setShowError] = React.useState(false);

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleGoHome = () => {
        navigate('/');
    };

    const handleRetry = () => {
        if (resetError) {
            resetError();
        } else {
            handleRefresh();
        }
    };

    return (
        <div className={`min-h-[400px] flex items-center justify-center p-4 ${className}`}>
            <Card className="w-full max-w-md glass-card border-destructive/30">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <CardTitle className="text-xl text-foreground">{title}</CardTitle>
                </CardHeader>

                <CardContent className="text-center">
                    <p className="text-muted-foreground mb-4">{description}</p>

                    {/* أزرار العمل */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            onClick={handleRetry}
                            className="bg-gradient-primary shadow-glow btn-glow"
                        >
                            <RefreshCw className="w-4 h-4 ml-2" />
                            إعادة المحاولة
                        </Button>

                        {showBackButton && (
                            <Button
                                variant="outline"
                                onClick={handleGoBack}
                            >
                                <ArrowLeft className="w-4 h-4 ml-2" />
                                رجوع
                            </Button>
                        )}

                        {showHomeButton && (
                            <Button
                                variant="ghost"
                                onClick={handleGoHome}
                            >
                                <Home className="w-4 h-4 ml-2" />
                                الرئيسية
                            </Button>
                        )}
                    </div>
                </CardContent>

                {/* تفاصيل الخطأ للمطورين */}
                {showDetails && error && (
                    <CardFooter className="flex-col pt-4 border-t border-border/30">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowError(!showError)}
                            className="text-muted-foreground text-xs"
                        >
                            <Bug className="w-3 h-3 ml-1" />
                            {showError ? 'إخفاء التفاصيل' : 'تفاصيل الخطأ (للمطورين)'}
                        </Button>

                        {showError && (
                            <div className="mt-3 p-3 bg-destructive/5 rounded-lg w-full overflow-auto max-h-48">
                                <p className="text-xs font-mono text-destructive font-bold mb-2">
                                    {error.name}: {error.message}
                                </p>
                                <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                                    {error.stack}
                                </pre>
                            </div>
                        )}
                    </CardFooter>
                )}
            </Card>
        </div>
    );
};

/**
 * مكون Loading Fallback
 * يعرض حالة التحميل
 */
interface LoadingFallbackProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    message = 'جاري التحميل...',
    size = 'md',
}) => {
    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10',
        lg: 'w-16 h-16',
    };

    return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-4">
            <div className="relative">
                <div className={`${sizeClasses[size]} rounded-full border-4 border-primary/20 border-t-primary animate-spin`} />
                <img
                    src={logo}
                    alt="RAAN"
                    className={`absolute inset-0 m-auto ${size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-5 h-5' : 'w-3 h-3'}`}
                />
            </div>
            <p className="mt-4 text-muted-foreground text-sm">{message}</p>
        </div>
    );
};

/**
 * مكون Empty State
 * يعرض حالة عدم وجود بيانات
 */
interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
}) => {
    return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
            {icon && (
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
            )}
            {action && (
                <Button onClick={action.onClick} className="bg-gradient-primary">
                    {action.label}
                </Button>
            )}
        </div>
    );
};

/**
 * مكون Network Error
 * يعرض خطأ الاتصال بالشبكة
 */
export const NetworkError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
    return (
        <ErrorFallback
            title="لا يوجد اتصال بالإنترنت"
            description="تحقق من اتصالك بالإنترنت وحاول مرة أخرى"
            resetError={onRetry}
            showHomeButton={false}
            showBackButton={false}
        />
    );
};

export default ErrorFallback;
