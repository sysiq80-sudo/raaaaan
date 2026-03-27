import { useState, useEffect, useRef, useMemo } from "react";
import {
  Send,
  MessageCircle,
  Phone,
  Camera,
  Image as ImageIcon,
  MapPin,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
        setMessages(data as Message[]);
        const unread = data.filter(
          (m: any) => !m.is_read && m.sender_type !== userType,
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
  }, [rideId, userType, open]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (open && unreadCount > 0) {
      setUnreadCount(0);
    }
  }, [open, unreadCount]);

  useEffect(() => {
    if (rideStatus === "arrived" && !chatEnded) {
      setChatEnded(true);
      setMessages((prev) => [
        ...prev,
        {
          id: "system-arrived",
          message: "✅ وصل السائق إلى موقعك - المحادثة ستُغلق",
          sender_type: "rider" as const,
          created_at: new Date().toISOString(),
          is_read: true,
        },
      ]);
      setTimeout(() => setOpen(false), 3000);
    }

    if (rideStatus === "completed" || rideStatus === "cancelled") {
      setChatEnded(true);
      setOpen(false);
    }
  }, [rideStatus, chatEnded]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("ride_messages").insert({
        ride_id: rideId,
        sender_type: userType,
        sender_id: user.id,
        message: text.trim(),
      });

      if (error) throw error;
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

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("ride-photos")
        .upload(fileName, file);

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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-9 px-3">
          <MessageCircle className="h-4 w-4 ml-1" />
          محادثة
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="h-[85vh] max-h-[85vh] flex flex-col p-0"
      >
        <SheetHeader className="flex flex-row items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <SheetTitle>المحادثة مع السائق</SheetTitle>
          {driverPhone && (
            <Button variant="outline" size="icon" className="h-9 w-9" asChild>
              <a href={`tel:${driverPhone}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
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
                    msg.sender_type === userType
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.sender_type === userType
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {isImageMessage(msg.message) ? (
                      <div className="space-y-2">
                        <p className="flex items-center gap-1">
                          <ImageIcon className="w-4 h-4" />
                          صورة الموقع
                        </p>
                        <img
                          src={extractImageUrl(msg.message) || ""}
                          alt="صورة الموقع"
                          className="rounded-lg max-w-full h-auto max-h-48 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    ) : (
                      <p>{msg.message}</p>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender_type === userType
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
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

          {/* Quick messages - سياقية حسب حالة الرحلة */}
          {!chatEnded && (
            <div className="py-3 border-t flex-shrink-0 space-y-2">
              {/* زر "سأرشد السائق" - للراكب فقط عند حالة accepted أو arrived */}
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors active:scale-[0.98] border border-primary/20"
                  >
                    <Navigation className="w-4 h-4" />
                    سأرشد السائق لموقعي
                  </button>
                )}

              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {(
                  QUICK_MESSAGES_BY_STATUS[userType][
                    rideStatus as keyof typeof QUICK_MESSAGES_BY_STATUS.rider
                  ] || QUICK_MESSAGES_BY_STATUS[userType].default
                ).map((msg) => (
                  <Button
                    key={msg}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 text-xs whitespace-nowrap rounded-full"
                    onClick={() => {
                      sendMessage(msg);
                      playSound("message_sent");
                    }}
                    disabled={sending}
                  >
                    {msg}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input with Camera */}
          {!chatEnded && (
            <form
              onSubmit={handleSubmit}
              className="flex gap-2 py-4 border-t flex-shrink-0"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCapturePhoto}
                disabled={uploadingImage || sending}
                className="flex-shrink-0"
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="اكتب رسالة..."
                disabled={sending || uploadingImage}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={sending || uploadingImage || !newMessage.trim()}
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
