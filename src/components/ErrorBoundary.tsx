import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 bg-destructive/5 rounded-2xl border border-destructive/20">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">حدث خطأ غير متوقع</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            عذراً، حدث خطأ أثناء عرض هذا القسم. يمكنك المحاولة مرة أخرى أو تحديث الصفحة.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة المحاولة
            </Button>
            <Button onClick={this.handleRefresh}>
              تحديث الصفحة
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 p-3 bg-muted rounded-lg text-xs text-muted-foreground max-w-full overflow-auto">
              <summary className="cursor-pointer font-medium">تفاصيل الخطأ (للمطورين)</summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
              <pre className="mt-1 whitespace-pre-wrap text-[10px]">{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
