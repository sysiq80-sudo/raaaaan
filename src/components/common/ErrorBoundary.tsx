/**
 * ران - Error Boundary Component
 * يلتقط الأخطاء ويمنع انهيار التطبيق
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error Boundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });

        // يمكن إرسال الخطأ لخدمة تتبع الأخطاء
        // logErrorToService(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4">
                    <div className="max-w-md w-full text-center">
                        {/* أيقونة الخطأ */}
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-10 h-10 text-destructive" />
                        </div>

                        {/* العنوان */}
                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            حدث خطأ غير متوقع
                        </h1>

                        <p className="text-muted-foreground mb-6">
                            نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
                        </p>

                        {/* تفاصيل الخطأ (للمطورين) */}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="mb-6 p-4 bg-muted rounded-lg text-left overflow-auto max-h-40">
                                <p className="text-xs font-mono text-destructive">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        {/* أزرار الإجراءات */}
                        <div className="flex gap-3 justify-center">
                            <Button
                                variant="outline"
                                onClick={this.handleGoHome}
                                className="gap-2"
                            >
                                <Home className="w-4 h-4" />
                                الرئيسية
                            </Button>
                            <Button
                                onClick={this.handleRetry}
                                className="gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                إعادة المحاولة
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
