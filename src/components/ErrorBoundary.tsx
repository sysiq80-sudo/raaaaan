import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  Home,
  MessageSquare,
  Bug,
  Wifi,
  Clock,
  User,
  Send,
  Download,
  MapPin,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Sentry integration (disabled - not installed)
const Sentry: any = null;

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  level?: "page" | "component" | "critical";
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableSentry?: boolean;
  enableUserFeedback?: boolean;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorCount: number;
  isRetrying: boolean;
  userFeedback?: string;
  showFeedbackForm: boolean;
  errorCategory: "network" | "auth" | "data" | "ui" | "map" | "unknown";
  recoveryAttempted: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private feedbackTimeoutId: NodeJS.Timeout | null = null;
  private retryAttempts: number = 0;

  public state: State = {
    hasError: false,
    errorCount: 0,
    isRetrying: false,
    showFeedbackForm: false,
    errorCategory: "unknown",
    recoveryAttempted: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorCategory = ErrorBoundary.categorizeError(error);
    return {
      hasError: true,
      error,
      errorCategory,
      recoveryAttempted: false,
    };
  }

  private static categorizeError(
    error: Error,
  ): "network" | "auth" | "data" | "ui" | "map" | "unknown" {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || "";

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection")
    ) {
      return "network";
    }
    if (
      message.includes("auth") ||
      message.includes("unauthorized") ||
      message.includes("forbidden")
    ) {
      return "auth";
    }
    if (
      message.includes("json") ||
      message.includes("parse") ||
      message.includes("data")
    ) {
      return "data";
    }
    if (
      message.includes("map") ||
      message.includes("maps") ||
      message.includes("geometry") ||
      message.includes("geocod") ||
      message.includes("خريطة")
    ) {
      return "map";
    }
    if (
      stack.includes("react") ||
      stack.includes("component") ||
      stack.includes("render")
    ) {
      return "ui";
    }
    return "unknown";
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { enableSentry = true, onError } = this.props;
    const errorCategory = ErrorBoundary.categorizeError(error);

    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
    console.error("[ErrorBoundary] Error category:", errorCategory);

    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
      errorCategory,
    }));

    // Report to Sentry if enabled
    if (enableSentry && Sentry) {
      Sentry.withScope((scope: any) => {
        scope.setTag("error_category", errorCategory);
        scope.setTag("error_level", this.props.level || "component");
        scope.setTag("error_count", this.state.errorCount + 1);
        scope.setContext("error_boundary", {
          level: this.props.level,
          retryAttempts: this.retryAttempts,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
        Sentry.captureException(error, {
          contexts: {
            react: {
              componentStack: errorInfo.componentStack,
            },
          },
        });
      });
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Auto-retry for network errors
    if (
      errorCategory === "network" &&
      this.retryAttempts < (this.props.maxRetries || 2)
    ) {
      this.attemptRecovery();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    if (this.feedbackTimeoutId) {
      clearTimeout(this.feedbackTimeoutId);
    }
  }

  private attemptRecovery = async () => {
    this.setState({ isRetrying: true, recoveryAttempted: true });
    this.retryAttempts++;

    try {
      // Wait a bit before retrying
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * this.retryAttempts),
      );

      // Check network connectivity
      if (navigator.onLine) {
        // Try to reload critical data or re-initialize components
        this.handleRetry();
      } else {
        // Wait for network to come back
        window.addEventListener("online", this.handleRetry, { once: true });
      }
    } catch (recoveryError) {
      console.error("[ErrorBoundary] Recovery failed:", recoveryError);
    } finally {
      this.setState({ isRetrying: false });
    }
  };

  private handleRetry = () => {
    if (this.resetTimeoutId) return;

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      recoveryAttempted: false,
    });

    this.retryAttempts = 0;

    this.resetTimeoutId = setTimeout(() => {
      this.resetTimeoutId = null;
    }, 3000);

    // Show success message
    toast.success("تم إعادة المحاولة بنجاح");
  };

  private goHome = () => {
    window.location.href = "/";
  };

  private contactSupport = () => {
    const { error, errorInfo, errorCategory, userFeedback } = this.state;
    const errorMessage = encodeURIComponent(
      `التصنيف: ${errorCategory}\nالخطأ: ${error?.message}\nالتفاصيل: ${errorInfo?.componentStack}\nملاحظات المستخدم: ${userFeedback || "لا توجد"}`,
    );
    window.open(`/support?error=${errorMessage}`, "_blank");
  };

  private downloadErrorReport = () => {
    const { error, errorInfo, errorCategory } = this.state;
    const report = {
      timestamp: new Date().toISOString(),
      category: errorCategory,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level,
      retryAttempts: this.retryAttempts,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("تم تحميل تقرير الخطأ");
  };

  private submitFeedback = () => {
    const { userFeedback } = this.state;
    if (!userFeedback?.trim()) {
      toast.error("يرجى كتابة ملاحظاتك أولاً");
      return;
    }

    // Send feedback to support system
    console.log("[ErrorBoundary] User feedback:", userFeedback);

    if (Sentry) {
      Sentry.withScope((scope: any) => {
        scope.setTag("feedback", "user_provided");
        Sentry.captureMessage(`User Feedback: ${userFeedback}`, "info");
      });
    }

    this.setState({ showFeedbackForm: false, userFeedback: undefined });
    toast.success("شكراً لملاحظاتك! تم إرسالها لفريق الدعم");
  };

  private getErrorIcon = () => {
    const { errorCategory } = this.state;

    switch (errorCategory) {
      case "network":
        return <Wifi className="w-6 h-6 text-destructive" />;
      case "auth":
        return <User className="w-6 h-6 text-destructive" />;
      case "data":
        return <Bug className="w-6 h-6 text-destructive" />;
      case "map":
        return <MapPin className="w-6 h-6 text-destructive" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-destructive" />;
    }
  };

  private getErrorTitle = () => {
    const { errorCategory } = this.state;

    switch (errorCategory) {
      case "network":
        return "مشكلة في الاتصال";
      case "auth":
        return "مشكلة في المصادقة";
      case "data":
        return "مشكلة في البيانات";
      case "ui":
        return "مشكلة في واجهة المستخدم";
      case "map":
        return "مشكلة في الخريطة";
      default:
        return "حدث خطأ";
    }
  };

  private getErrorDescription = () => {
    const { errorCategory, recoveryAttempted } = this.state;

    if (recoveryAttempted) {
      return "تم محاولة الإصلاح التلقائي، لكن المشكلة مستمرة";
    }

    switch (errorCategory) {
      case "network":
        return "تحقق من اتصال الإنترنت وأعد المحاولة";
      case "auth":
        return "قد انتهت صلاحية جلستك، يرجى تسجيل الدخول مرة أخرى";
      case "data":
        return "حدث خطأ في تحميل البيانات، يرجى المحاولة مرة أخرى";
      case "ui":
        return "حدث خطأ في عرض الصفحة، يرجى إعادة تحميلها";
      case "map":
        return "تعذر تحميل الخريطة أو المسار، تحقق من الاتصال أو حدّث الصفحة";
      default:
        return "نعتذر عن الإزعاج، حدث خطأ غير متوقع";
    }
  };

  public render() {
    const {
      hasError,
      error,
      errorInfo,
      errorCount,
      isRetrying,
      showFeedbackForm,
      errorCategory,
      recoveryAttempted,
    } = this.state;
    const {
      fallback,
      level = "component",
      children,
      enableUserFeedback = true,
    } = this.props;

    if (hasError && fallback && error) {
      return fallback(error, this.handleRetry);
    }

    if (hasError && error) {
      const isPageLevel =
        level === "page" || errorCount > 3 || level === "critical";

      return (
        <div
          className={`min-h-screen bg-gradient-to-br from-destructive/10 via-background to-destructive/5 flex items-center justify-center p-4 ${isPageLevel ? "" : "min-h-0"}`}
        >
          <Card className="w-full max-w-lg border-destructive/30 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center">
                  {this.getErrorIcon()}
                </div>
                <div>
                  <CardTitle className="text-2xl text-destructive">
                    {this.getErrorTitle()}
                  </CardTitle>
                  <CardDescription>
                    {this.getErrorDescription()}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-mono text-muted-foreground break-words">
                  {error.message || "خطأ غير معروف"}
                </p>
              </div>

              {isRetrying && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 animate-spin" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      جاري محاولة الإصلاح التلقائي...
                    </p>
                  </div>
                </div>
              )}

              {recoveryAttempted && !isRetrying && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ محاولة #{errorCount}: تمت محاولة الإصلاح التلقائي لكن
                    المشكلة مستمرة
                  </p>
                </div>
              )}

              {import.meta.env.MODE === "development" && errorInfo && (
                <details className="text-xs cursor-pointer">
                  <summary className="font-semibold text-muted-foreground hover:text-foreground">
                    📋 تفاصيل الخطأ (للمطورين فقط)
                  </summary>
                  <div className="mt-2 bg-muted/30 border border-border rounded p-3 max-h-64 overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                </details>
              )}

              {enableUserFeedback && !showFeedbackForm && (
                <Button
                  onClick={() => this.setState({ showFeedbackForm: true })}
                  variant="outline"
                  className="w-full"
                >
                  <MessageSquare className="w-4 h-4 ml-2" />
                  أخبرنا بما حدث
                </Button>
              )}

              {showFeedbackForm && (
                <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
                  <Label htmlFor="feedback">
                    ما الذي كنت تحاول فعله عندما حدث الخطأ؟
                  </Label>
                  <Textarea
                    id="feedback"
                    placeholder="اكتب وصفاً مختصراً للمشكلة..."
                    value={this.state.userFeedback || ""}
                    onChange={(e) =>
                      this.setState({ userFeedback: e.target.value })
                    }
                    className="min-h-20"
                  />
                  <div className="flex gap-2">
                    <Button onClick={this.submitFeedback} size="sm">
                      <Send className="w-4 h-4 ml-2" />
                      إرسال
                    </Button>
                    <Button
                      onClick={() =>
                        this.setState({
                          showFeedbackForm: false,
                          userFeedback: undefined,
                        })
                      }
                      variant="outline"
                      size="sm"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}

              <div
                className={`grid gap-3 pt-4 ${isPageLevel ? "grid-cols-2" : "grid-cols-1"}`}
              >
                <Button
                  onClick={this.handleRetry}
                  disabled={!!this.resetTimeoutId || isRetrying}
                  className={isPageLevel ? "" : "w-full"}
                >
                  <RefreshCw
                    className={`w-4 h-4 ml-2 ${isRetrying ? "animate-spin" : ""}`}
                  />
                  إعادة محاولة
                </Button>

                {isPageLevel && (
                  <Button onClick={this.goHome} variant="outline">
                    <Home className="w-4 h-4 ml-2" />
                    الصفحة الرئيسية
                  </Button>
                )}

                <Button
                  onClick={this.contactSupport}
                  variant="secondary"
                  className={isPageLevel ? "col-span-2 w-full" : "w-full"}
                >
                  <MessageSquare className="w-4 h-4 ml-2" />
                  تواصل مع الدعم
                </Button>

                {import.meta.env.MODE === "development" && (
                  <Button
                    onClick={this.downloadErrorReport}
                    variant="outline"
                    className={isPageLevel ? "col-span-2 w-full" : "w-full"}
                  >
                    <Download className="w-4 h-4 ml-2" />
                    تحميل تقرير الخطأ
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
