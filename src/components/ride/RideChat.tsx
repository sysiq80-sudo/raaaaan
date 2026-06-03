import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";
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
        setMessages(data as unknown as Message[]);
        const unread = (data as unknown as Message[]).filter(
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
  }, [rideId, userType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && unreadCount > 0) {
      setUnreadCount(0);
      (supabase as any)
        .rpc('mark_messages_as_read', { p_ride_id: rideId })
        .then();
    }
  }, [open, unreadCount, rideId, userType]);

  // ── Parallel Chat: المحادثة تعمل بشكل مستقل عن حالة الرحلة
  // تُغلق فقط عند اكتمال أو إلغاء الرحلة
  useEffect(() => {
    if (rideStatus === 'completed' || rideStatus === 'cancelled') {
      setChatEnded(true);
      setMessages(prev => [...prev, {
        id: 'system-ended',
        message: rideStatus === 'completed'
          ? '✅ تمت الرحلة بنجاح - شكراً لاستخدامك ران'
          : '❌ تم إلغاء الرحلة',
        sender_type: 'rider' as const,
        created_at: new Date().toISOString(),
        is_read: true,
      }]);
      setTimeout(() => setOpen(false), 3000);
    }
  }, [rideStatus]);
  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await (supabase as any)
        .rpc('send_ride_message', {
          p_ride_id: rideId,
          p_message: text.trim(),
        });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "send_ride_message_failed");
      }

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

  const chatTitle = userType === 'rider' ? 'المحادثة مع السائق' : 'المحادثة مع الراكب';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all active:scale-95"
          style={{ background: 'rgba(91,221,166,0.1)', color: '#5bdda6', border: '1px solid rgba(91,221,166,0.2)' }}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          محادثة
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.4)' }}>
              {unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[85vh] max-h-[85vh] flex flex-col p-0 border-0"
        style={{ background: '#0b1326', borderTop: '1px solid rgba(91,221,166,0.15)' }}
      >
        {/* ── الهيدر ── */}
        <SheetHeader className="flex flex-row items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0d1730' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(91,221,166,0.1)', border: '1px solid rgba(91,221,166,0.2)' }}>
              <MessageCircle className="w-4 h-4" style={{ color: '#5bdda6' }} />
            </div>
            <SheetTitle className="text-[15px] font-bold text-white">{chatTitle}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-hidden" dir="rtl">
          {/* ── الرسائل ── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#080f20' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                <MessageCircle className="w-12 h-12 text-white/20" />
                <p className="text-[13px] font-semibold text-white/30">لا توجد رسائل بعد</p>
                <p className="text-[11px] text-white/15">ابدأ المحادثة أو اختر رسالة سريعة</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === userType ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-2.5"
                    style={
                      msg.sender_type === userType
                        ? { background: 'rgba(91,221,166,0.12)', border: '1px solid rgba(91,221,166,0.15)' }
                        : { background: '#171f33', border: '1px solid rgba(255,255,255,0.06)' }
                    }
                  >
                    <p className={`text-[13px] font-medium leading-relaxed ${
                      msg.sender_type === userType ? 'text-white' : 'text-white/80'
                    }`}>{msg.message}</p>
                    <p className="text-[10px] mt-1 text-white/25">
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

          {/* ── الرسائل السريعة ── */}
          {!chatEnded && (
            <div className="px-4 py-2.5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#0b1326' }}>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {QUICK_MESSAGES[userType].map((msg) => (
                  <button
                    key={msg}
                    className="flex-shrink-0 text-[11px] font-bold whitespace-nowrap px-3 py-1.5 rounded-full transition-all active:scale-95"
                    style={{ background: '#171f33', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                    onClick={() => sendMessage(msg)}
                    disabled={sending}
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── حقل الإدخال ── */}
          {!chatEnded && (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d1730' }}
            >
              <div className="flex-1 relative">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="اكتب رسالة..."
                  disabled={sending}
                  className="h-10 rounded-xl border-0 text-[13px] text-white placeholder:text-white/20 pr-4 pl-4"
                  style={{ background: '#171f33' }}
                />
              </div>
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30"
                style={{ background: '#5bdda6', boxShadow: '0 0 12px rgba(91,221,166,0.25)' }}
              >
                <Send className="h-4 w-4 text-[#0b1326]" />
              </button>
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
