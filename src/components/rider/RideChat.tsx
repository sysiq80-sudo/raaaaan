import { useState, useEffect, useRef } from "react";
import {
  Send,
  MessageCircle,
  Phone,
  Camera,
  Image as ImageIcon,
  Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { playSound } from "@/utils/sounds";

interface Message {
  id: string;
  message: string;
  sender_type: "rider" | "driver";
  created_at: string;
  is_read: boolean;
}

interface RideChatProps {
  rideId: string;
  userType: "rider" | "driver";
  rideStatus?: string;
  driverPhone?: string;
  pickupAddress?: string;
  iconOnly?: boolean;
}

// رسائل سريعة سياقية حسب حالة الرحلة - عراقية أصلية
const QUICK_MESSAGES_BY_STATUS = {
  rider: {
    pending: [
      "أنا في انتظارك",
      "أين وصلت؟",
      "سأكون جاهز خلال دقائق",
      "على الشارع الرئيسي",
      "عند المدخل الرئيسي",
    ],
    accepted: [
      "أنا جاهز",
      "أين أنت الآن؟",
      "كم باقي وصولك؟",
      "سأرشدك للموقع",
      "على الباب مباشرة",
      "دقيقة وأنزل",
    ],
    arrived: [
      "شنو لون السيارة؟",
      "وين بالضبط؟",
      "قادم إليك الآن",
      "أنا عند المدخل",
      "دقيقة واحدة فقط",
    ],
    in_progress: [
      "شكراً",
      "ممكن تروح أسرع؟",
      "ممكن تمر من الطريق الثاني؟",
      "هنا أوقف لو سمحت",
      "عدل الشغل 👍",
    ],
    default: [
      "أنا في انتظارك",
      "أين أنت الآن؟",
      "سأكون جاهزاً خلال دقائق",
      "شكراً",
    ],
  },
  driver: {
    pending: ["أنا في الطريق إليك", "باقي دقائق قليلة", "وين موقعك بالضبط؟"],
    accepted: [
      "أنا في الطريق إليك",
      "5 دقائق وأوصل",
      "وصفلي المكان",
      "اطلع واستناني",
    ],
    arrived: [
      "وصلت، أين أنت؟",
      "أنا عند الباب",
      "اطلع لو سمحت",
      "أنا بالسيارة البيضاء",
      "شوفني عند المدخل",
    ],
    in_progress: ["إن شاء الله نوصل بسرعة", "الطريق زحمة شوي", "أهلاً وسهلاً"],
    default: [
      "أنا في الطريق إليك",
      "وصلت، أين أنت؟",
      "انتظرني دقيقة واحدة",
      "أهلاً وسهلاً",
    ],
  },
};

export const RideChat = ({
  rideId,
  userType,
  rideStatus,
  driverPhone,
  pickupAddress,
  iconOnly = false,
}: RideChatProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatEnded, setChatEnded] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!rideId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("ride_messages")
        .select("*")
        .eq("ride_id", rideId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data as unknown as Message[]);
        const unread = (data as unknown as Message[]).filter(
          (m) => !m.is_read && m.sender_type !== userType,
        ).length;
        setUnreadCount(unread);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_messages",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          if (newMsg.sender_type !== userType) {
            if (!open) {
              setUnreadCount((prev) => prev + 1);
              playSound("message_received");
              toast({
                title: "رسالة جديدة",
                description: newMsg.message.substring(0, 50),
              });
            }
          }
        },
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
        .rpc("mark_messages_as_read", { p_ride_id: rideId })
        .then();
    }
  }, [open, unreadCount, rideId, userType]);

  useEffect(() => {
    // المحادثة تُغلق فقط عند اكتمال أو إلغاء الرحلة
    if (rideStatus === "completed" || rideStatus === "cancelled") {
      setChatEnded(true);
      setMessages((prev) => [
        ...prev,
        {
          id: "system-ended",
          message: rideStatus === "completed"
            ? "✅ تمت الرحلة بنجاح - شكراً لاستخدامك ران"
            : "❌ تم إلغاء الرحلة",
          sender_type: "rider" as const,
          created_at: new Date().toISOString(),
          is_read: true,
        },
      ]);
      setTimeout(() => setOpen(false), 3000);
    }
  }, [rideStatus]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await (supabase as any)
        .rpc("send_ride_message", {
          p_ride_id: rideId,
          p_message: text.trim(),
        });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "send_ride_message_failed");
      }
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "خطأ في إرسال الرسالة",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  const handleCapturePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // رفع الصورة إلى Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${rideId}/${Date.now()}.${fileExt}`;

      // ✅ ضغط الصورة قبل الرفع
      const { compressImage } = await import('@/utils/compressImage');
      const compressed = await compressImage(file, { maxDimension: 800, quality: 0.7 });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ride-photos")
        .upload(fileName, compressed);

      if (uploadError) {
        // إذا لم يكن الـ bucket موجود، نرسل رسالة نصية بدلاً من الصورة
        console.error("Upload error:", uploadError);
        await sendMessage("📍 أرسلت صورة لموقعي الحالي");
        toast({
          title: "تم إرسال إشعار بالموقع",
          description: "لم يتم رفع الصورة لكن تم إعلام السائق",
        });
        return;
      }

      // الحصول على رابط الصورة العام
      const {
        data: { publicUrl },
      } = supabase.storage.from("ride-photos").getPublicUrl(fileName);

      // إرسال رسالة مع رابط الصورة
      await sendMessage(`📷 صورة موقعي: ${publicUrl}`);

      toast({
        title: "تم إرسال الصورة",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "خطأ في رفع الصورة",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // التحقق مما إذا كانت الرسالة تحتوي على صورة
  const isImageMessage = (message: string) => {
    return message.includes("📷 صورة موقعي:") && message.includes("http");
  };

  const extractImageUrl = (message: string) => {
    const match = message.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  };

  const chatTitle = userType === 'rider' ? 'المحادثة مع السائق' : 'المحادثة مع الراكب';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={`relative flex items-center justify-center rounded-xl text-[12px] font-bold transition-all active:scale-95 ${
            iconOnly ? "h-10 w-10 shrink-0" : "gap-1.5 px-3 py-2"
          }`}
          style={{ background: 'rgba(91,221,166,0.1)', color: '#5bdda6', border: '1px solid rgba(91,221,166,0.2)' }}
        >
          <MessageCircle className="h-4 w-4" />
          {!iconOnly && "محادثة"}
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
          <div className="flex items-center gap-2">
            {driverPhone && (
              <a
                href={`tel:${driverPhone}`}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <Phone className="h-4 w-4 text-blue-400" />
              </a>
            )}
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
                  className={`flex ${
                    msg.sender_type === userType ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className="max-w-[80%] rounded-2xl px-4 py-2.5"
                    style={
                      msg.sender_type === userType
                        ? { background: 'rgba(91,221,166,0.12)', border: '1px solid rgba(91,221,166,0.15)' }
                        : { background: '#171f33', border: '1px solid rgba(255,255,255,0.06)' }
                    }
                  >
                    {isImageMessage(msg.message) ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1 text-[12px]" style={{ color: '#5bdda6' }}>
                          <ImageIcon className="w-3.5 h-3.5" />
                          صورة الموقع
                        </p>
                        <img
                          src={extractImageUrl(msg.message) || ""}
                          alt="صورة الموقع"
                          className="rounded-xl max-w-full h-auto max-h-48 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    ) : (
                      <p className={`text-[13px] font-medium leading-relaxed ${
                        msg.sender_type === userType ? 'text-white' : 'text-white/80'
                      }`}>{msg.message}</p>
                    )}
                    <p className="text-[10px] mt-1 text-white/25">
                      {new Date(msg.created_at).toLocaleTimeString("ar-IQ", {
                        hour: "2-digit",
                        minute: "2-digit",
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
            <div className="px-4 py-2.5 flex-shrink-0 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#0b1326' }}>
              {/* زر إرشاد السائق */}
              {userType === "rider" &&
                (rideStatus === "accepted" || rideStatus === "arrived") && (
                  <button
                    onClick={() => {
                      const guideMsg = pickupAddress
                        ? `📍 سأرشدك للموقع - أنا عند: ${pickupAddress}`
                        : "📍 سأرشدك للموقع - تابع معي";
                      sendMessage(guideMsg);
                      playSound("message_sent");
                    }}
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all active:scale-[0.98]"
                    style={{ background: 'rgba(91,221,166,0.08)', color: '#5bdda6', border: '1px solid rgba(91,221,166,0.15)' }}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    سأرشد السائق لموقعي
                  </button>
                )}

              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {(
                  QUICK_MESSAGES_BY_STATUS[userType][
                    rideStatus as keyof typeof QUICK_MESSAGES_BY_STATUS.rider
                  ] || QUICK_MESSAGES_BY_STATUS[userType].default
                ).map((msg) => (
                  <button
                    key={msg}
                    className="flex-shrink-0 text-[11px] font-bold whitespace-nowrap px-3 py-1.5 rounded-full transition-all active:scale-95"
                    style={{ background: '#171f33', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}
                    onClick={() => {
                      sendMessage(msg);
                      playSound("message_sent");
                    }}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={handleCapturePhoto}
                disabled={uploadingImage || sending}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
                style={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Camera className="h-4 w-4 text-white/40" />
              </button>
              <div className="flex-1 relative">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="اكتب رسالة..."
                  disabled={sending || uploadingImage}
                  className="h-10 rounded-xl border-0 text-[13px] text-white placeholder:text-white/20 pr-4 pl-4"
                  style={{ background: '#171f33' }}
                />
              </div>
              <button
                type="submit"
                disabled={sending || uploadingImage || !newMessage.trim()}
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
