/**
 * صفحة محادثات البوت - Bot Conversations Chat Interface
 * عرض وإدارة المحادثات عبر واتساب وتليجرام وسي إم إس
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Search,
  Send,
  Phone,
  RefreshCw,
  Download,
  Calendar,
  Hash,
  User,
  Users,
  Globe,
  ArrowLeft,
  MoreVertical,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";

interface BotCustomer {
  id: string;
  platform: "whatsapp" | "telegram" | "sms";
  platform_id: string;
  display_name: string | null;
  phone_number: string | null;
  last_active: string;
  interaction_count: number;
}

interface ConversationMessage {
  id: string;
  message: string;
  direction: "incoming" | "outgoing";
  platform: "whatsapp" | "telegram" | "sms";
  created_at: string;
  metadata: any;
}

const AdminBotChats = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();

  const [customers, setCustomers] = useState<BotCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<BotCustomer | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [newMessage, setNewMessage] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── إحصائيات ───
  const stats = useMemo(() => {
    const total = customers.length;
    const whatsapp = customers.filter((c) => c.platform === "whatsapp").length;
    const telegram = customers.filter((c) => c.platform === "telegram").length;
    const sms = customers.filter((c) => c.platform === "sms").length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = customers.filter(
      (c) => new Date(c.last_active) >= today
    ).length;
    const totalInteractions = customers.reduce(
      (sum, c) => sum + (c.interaction_count || 0),
      0
    );
    return { total, whatsapp, telegram, sms, activeToday, totalInteractions };
  }, [customers]);

  // ─── جلب العملاء ───
  useEffect(() => {
    if (isAdmin) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bot_customers")
      .select("*")
      .order("last_active", { ascending: false });

    if (error) {
      console.error("Failed to fetch bot_customers:", error);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات العملاء",
        variant: "destructive",
      });
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  // ─── جلب المحادثات ───
  const fetchConversation = async (customerId: string) => {
    setMessagesLoading(true);
    const { data, error } = await (supabase as any)
      .from("bot_conversation_messages")
      .select("*")
      .eq("bot_customer_id", customerId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Failed to fetch conversation:", error);
      toast({
        title: "خطأ",
        description: "فشل في جلب المحادثة",
        variant: "destructive",
      });
    } else {
      setMessages(data || []);
    }
    setMessagesLoading(false);
  };

  // ─── اختيار عميل ───
  const selectCustomer = (customer: BotCustomer) => {
    setSelectedCustomer(customer);
    fetchConversation(customer.id);
  };

  // ─── إرسال رسالة جديدة ───
  const sendMessage = async () => {
    if (!selectedCustomer || !newMessage.trim()) return;

    try {
      const { error } = await (supabase as any)
        .rpc("log_bot_outgoing_message", {
          p_bot_customer_id: selectedCustomer.id,
          p_message: newMessage.trim(),
          p_platform: selectedCustomer.platform,
          p_metadata: { sent_from_admin: true }
        });

      if (error) throw error;

      // إضافة الرسالة للقائمة المحلية
      const newMsg: ConversationMessage = {
        id: Date.now().toString(), // temporary ID
        message: newMessage.trim(),
        direction: "outgoing",
        platform: selectedCustomer.platform,
        created_at: new Date().toISOString(),
        metadata: { sent_from_admin: true }
      };

      setMessages(prev => [...prev, newMsg]);
      setNewMessage("");

      toast({
        title: "تم الإرسال",
        description: "تم إرسال الرسالة بنجاح",
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "خطأ",
        description: "فشل في إرسال الرسالة",
        variant: "destructive",
      });
    }
  };

  // ─── تصفية العملاء ───
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone_number?.includes(searchQuery) ||
        customer.platform_id.includes(searchQuery);

      const matchesPlatform = platformFilter === "all" || customer.platform === platformFilter;

      return matchesSearch && matchesPlatform;
    });
  }, [customers, searchQuery, platformFilter]);

  // ─── التمرير لأسفل عند تحديث الرسائل ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-red-600">غير مصرح لك</h2>
          <p className="text-gray-600 mt-2">تحتاج صلاحيات مدير للوصول لهذه الصفحة</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ─── العنوان ─── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">محادثات البوت</h1>
            <p className="text-gray-600 mt-1">إدارة المحادثات عبر جميع المنصات</p>
          </div>
          <Button onClick={fetchCustomers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            تحديث
          </Button>
        </div>

        {/* ─── الإحصائيات ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">إجمالي العملاء</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">واتساب</p>
                  <p className="text-2xl font-bold">{stats.whatsapp}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Send className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-600">تليجرام</p>
                  <p className="text-2xl font-bold">{stats.telegram}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Phone className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">سي إم إس</p>
                  <p className="text-2xl font-bold">{stats.sms}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">نشط اليوم</p>
                  <p className="text-2xl font-bold">{stats.activeToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Hash className="h-5 w-5 text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">التفاعلات</p>
                  <p className="text-2xl font-bold">{stats.totalInteractions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── المحتوى الرئيسي ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── قائمة العملاء ─── */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                العملاء
              </CardTitle>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="البحث في العملاء..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المنصات</SelectItem>
                    <SelectItem value="whatsapp">واتساب</SelectItem>
                    <SelectItem value="telegram">تليجرام</SelectItem>
                    <SelectItem value="sms">سي إم إس</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد عملاء
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map((customer) => (
                      <div
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedCustomer?.id === customer.id
                            ? "bg-blue-50 border border-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {customer.display_name?.charAt(0) || customer.platform_id.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">
                                {customer.display_name || customer.phone_number || customer.platform_id}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {customer.platform}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              {customer.platform_id}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(customer.last_active), { locale: ar, addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ─── نافذة المحادثة ─── */}
          <Card className="lg:col-span-2">
            {selectedCustomer ? (
              <>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCustomer(null)}
                      className="lg:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar>
                      <AvatarFallback>
                        {selectedCustomer.display_name?.charAt(0) || selectedCustomer.platform_id.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">
                        {selectedCustomer.display_name || selectedCustomer.phone_number || selectedCustomer.platform_id}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedCustomer.platform} • {selectedCustomer.platform_id}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-auto">
                      {selectedCustomer.platform}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* ─── رسائل المحادثة ─── */}
                  <ScrollArea className="h-96 p-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        لا توجد رسائل في هذه المحادثة
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.direction === "outgoing"
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-100 text-gray-900"
                              }`}
                            >
                              <p className="text-sm">{message.message}</p>
                              <p className={`text-xs mt-1 ${
                                message.direction === "outgoing" ? "text-blue-100" : "text-gray-500"
                              }`}>
                                {format(new Date(message.created_at), "HH:mm", { locale: ar })}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* ─── إرسال رسالة جديدة ─── */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder="اكتب رسالة..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        className="flex-1"
                      />
                      <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">اختر محادثة</h3>
                  <p className="text-gray-500">اختر عميل من القائمة لبدء المحادثة</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminBotChats;