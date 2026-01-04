import React from 'react';
import { Headphones, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SupportButtonProps {
  variant?: 'icon' | 'full';
  className?: string;
}

const SupportButton: React.FC<SupportButtonProps> = ({ 
  variant = 'icon',
  className 
}) => {
  const supportPhone = '+9647700000000'; // يمكن جلبه من الإعدادات
  const whatsappNumber = '9647700000000';

  const handleWhatsApp = () => {
    window.open(`https://wa.me/${whatsappNumber}?text=مرحباً، أحتاج مساعدة`, '_blank');
  };

  const handleCall = () => {
    window.location.href = `tel:${supportPhone}`;
  };

  if (variant === 'full') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn("gap-2", className)}
          >
            <Headphones className="w-4 h-4" />
            الدعم الفني
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleWhatsApp} className="gap-2 cursor-pointer">
            <MessageCircle className="w-4 h-4 text-green-500" />
            <span>واتساب</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCall} className="gap-2 cursor-pointer">
            <Phone className="w-4 h-4 text-primary" />
            <span>اتصال مباشر</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className={cn("bg-background/95 backdrop-blur-sm shadow-lg border-border/50", className)}
        >
          <Headphones className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleWhatsApp} className="gap-2 cursor-pointer">
          <MessageCircle className="w-4 h-4 text-green-500" />
          <span>واتساب</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCall} className="gap-2 cursor-pointer">
          <Phone className="w-4 h-4 text-primary" />
          <span>اتصال مباشر</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SupportButton;
