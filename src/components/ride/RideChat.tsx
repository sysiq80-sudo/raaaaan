import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  id: string;
  message: string;
  sender_type: 'rider' | 'driver';
  created_at: string;
  is_read: boolean;
}

interface RideChatProps {
  rideId: string;
  userType: 'rider' | 'driver';
  rideStatus?: string;
}

const QUICK_MESSAGES = {
  rider: [
    "أنا في انتظارك",
    "أين أنت الآن؟",
    "سأكون جاهزاً خلال دقائق",
    "شكراً",
  ],
  driver: [
    "أنا في الطريق إليك",
    "وصلت، أين أنت؟",
    "انتظرني دقيقة واحدة",
    "أهلاً وسهلاً",
  ],
};

export const RideChat = ({ rideId, userType, rideStatus }: RideChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatEnded, setChatEnded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!rideId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('ride_messages')
        .select('*')
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
        // Count unread messages from other party
        const unread = data.filter(
          (m) => !m.is_read && m.sender_type !== userType
        ).length;
        setUnreadCount(unread);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
          filter: `ride_id=eq.${rideId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
          
          if (newMsg.sender_type !== userType) {
            if (!open) {
              setUnreadCount(prev => prev + 1);
              toast({
                title: "رسالة جديدة",
                description: newMsg.message.substring(0, 50),
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, userType, open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mark messages as read when chat is opened
    if (open && unreadCount > 0) {
      setUnreadCount(0);
    }
  }, [open, unreadCount]);

  // إغلاق المحادثة عند وصول السائق أو اكتمال الرحلة
  useEffect(() => {
    if (rideStatus === 'arrived' && !chatEnded) {
      setChatEnded(true);
      setMessages(prev => [...prev, {
        id: 'system-arrived',
        message: '✅ وصل السائق إلى موقعك - المحادثة ستُغلق',
        sender_type: 'rider' as const,
        created_at: new Date().toISOString(),
        is_read: true,
      }]);
      setTimeout(() => setOpen(false), 3000);
    }
    
    if (rideStatus === 'completed' || rideStatus === 'cancelled') {
      setChatEnded(true);
      setOpen(false);
    }
  }, [rideStatus, chatEnded]);
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('ride_messages')
        .insert({
          ride_id: rideId,
          sender_type: userType,
          sender_id: user.id,
          message: text.trim()
        });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "خطأ في إرسال الرسالة",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <MessageCircle className="h-4 w-4 ml-2" />
          محادثة
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
          <SheetTitle>المحادثة</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-hidden px-6">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد رسائل بعد
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_type === userType ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.sender_type === userType
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.sender_type === userType
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString('ar-IQ', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick messages */}
          {!chatEnded && (
            <div className="flex gap-2 overflow-x-auto py-3 scrollbar-hide border-t flex-shrink-0">
              {QUICK_MESSAGES[userType].map((msg) => (
                <Button
                  key={msg}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 text-xs whitespace-nowrap"
                  onClick={() => sendMessage(msg)}
                  disabled={sending}
                >
                  {msg}
                </Button>
              ))}
            </div>
          )}

          {/* Input */}
          {!chatEnded && (
            <form onSubmit={handleSubmit} className="flex gap-2 py-4 border-t flex-shrink-0">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="اكتب رسالة..."
                disabled={sending}
                className="flex-1"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={sending || !newMessage.trim()}
                className="flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Alias for backward compatibility
export const ChatButton = RideChat;

export default RideChat;
