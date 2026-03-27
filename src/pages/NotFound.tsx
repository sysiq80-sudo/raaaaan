import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-4xl">🔍</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <p className="text-xl text-muted-foreground">الصفحة غير موجودة</p>
          <p className="text-sm text-muted-foreground/70">
            الصفحة التي تبحث عنها غير متوفرة أو تم نقلها
          </p>
        </div>
        <Link to="/">
          <Button className="gap-2 mt-4">
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
