import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, Send, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';

// Mock OpenAI integration - replace with actual OpenAI API when available
const mockOpenAI = {
  chat: {
    completions: {
      create: async (params: any) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock response based on ticket content
        const ticketContent = params.messages[1]?.content || '';
        let response = '';

        if (ticketContent.includes('مشكلة في الدفع')) {
          response = 'المشكلة في نظام الدفع. يرجى التحقق من صحة بيانات البطاقة والمحاولة مرة أخرى. إذا استمرت المشكلة، يرجى مراجعة قسم الدعم الفني.';
        } else if (ticketContent.includes('سائق')) {
          response = 'تم فحص السائق المطلوب. السائق معتمد ونشط في النظام. يرجى التأكد من صحة الموقع والوقت المطلوب للرحلة.';
        } else {
          response = 'شكراً لتواصلك معنا. تم تسجيل استفسارك وسيتم الرد عليك في أقرب وقت ممكن من قبل فريق الدعم.';
        }

        return {
          choices: [{
            message: {
              content: response
            }
          }]
        };
      }
    }
  }
};

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
    email: string;
    phone: string;
  };
}

interface AISuggestion {
  solution: string;
  confidence: number;
  estimatedTime: number;
  category: string;
  actions: string[];
}

export const AdminAIAssistant: React.FC = () => {
  const { t, language } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize OpenAI (mock for now)
  const openai = mockOpenAI;

  // Load support tickets (mock data for now)
  useEffect(() => {
    loadSupportTickets();
  }, []);

  const loadSupportTickets = async () => {
    try {
      // Mock data - replace with actual database query when support_tickets table is created
      const mockTickets: SupportTicket[] = [
        {
          id: '1',
          user_id: 'user-1',
          subject: 'مشكلة في الدفع',
          description: 'لا يمكنني إتمام عملية الدفع للرحلة رقم 12345',
          status: 'open',
          priority: 'high',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            name: 'أحمد محمد',
            email: 'ahmed@example.com',
            phone: '+9647501234567'
          }
        },
        {
          id: '2',
          user_id: 'user-2',
          subject: 'سائق غير متعاون',
          description: 'السائق تأخر عن الموعد المحدد وكان غير مهذب',
          status: 'open',
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user: {
            name: 'فاطمة علي',
            email: 'fatima@example.com',
            phone: '+9647512345678'
          }
        }
      ];

      setTickets(mockTickets);
    } catch (error) {
      console.error('Error loading support tickets:', error);
      setError('فشل في تحميل تذاكر الدعم');
    }
   };

  const generateAISuggestion = async (ticket: SupportTicket) => {
    if (!ticket) return;

    setIsLoading(true);
    setError(null);

    try {
      // جمع معلومات إضافية عن المستخدم والرحلات
      const { data: userRides } = await supabase
        .from('rides')
        .select('status, created_at, driver_id')
        .eq('rider_id', ticket.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: driverInfo } = await supabase
        .from('drivers')
        .select('rating, total_rides')
        .eq('user_id', ticket.user_id)
        .maybeSingle();

      // بناء السياق للذكاء الاصطناعي
      const context = `
        المشكلة: ${ticket.description}
        الأولوية: ${ticket.priority}
        حالة المستخدم: ${ticket.user ? 'مسجل' : 'غير مسجل'}
        عدد الرحلات السابقة: ${userRides?.length || 0}
        تقييم السائق: ${driverInfo?.rating || 'غير متوفر'}
        اللغة المفضلة: ${language === 'ar' ? 'العربية' : language === 'ku' ? 'الكردية' : 'الإنجليزية'}
      `;

      const prompt = `
        أنت مساعد دعم فني متخصص في تطبيق ران RAAN للتاكسي في العراق.
        المستخدم يواجه مشكلة ويحتاج إلى حل.

        السياق:
        ${context}

        المطلوب:
        1. قدم حلاً واضحاً ومفصلاً باللغة العربية
        2. حدد مستوى الثقة في الحل (من 0 إلى 100)
        3. قدر الوقت المطلوب لحل المشكلة (بالدقائق)
        4. حدد فئة المشكلة (تطبيق، دفع، سائق، حساب، أخرى)
        5. اقترح خطوات محددة للحل

        أجب بتنسيق JSON فقط:
        {
          "solution": "الحل المفصل",
          "confidence": 85,
          "estimatedTime": 15,
          "category": "تطبيق",
          "actions": ["الخطوة 1", "الخطوة 2", "الخطوة 3"]
        }
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "أنت مساعد دعم فني متخصص في تطبيق ران RAAN. أجب بتنسيق JSON فقط."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const response = completion.choices[0].message.content;
      if (response) {
        const suggestion: AISuggestion = JSON.parse(response);
        setAiSuggestion(suggestion);
      }

    } catch (err) {
      console.error('AI suggestion error:', err);
      setError('فشل في توليد اقتراح الذكاء الاصطناعي');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const sendToUser = async (ticketId: string, solution: string) => {
    try {
      // إرسال الرد للمستخدم عبر الإشعارات
      await supabase.from('notifications').insert({
        user_id: selectedTicket?.user_id,
        type: 'support_response',
        title: 'رد من الدعم الفني',
        message: solution,
        data: { ticket_id: ticketId }
      });

      // تحديث حالة التذكرة
      await (supabase as any)
        .from('support_tickets')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      alert('تم إرسال الرد للمستخدم بنجاح');
      loadSupportTickets();
    } catch (err) {
      console.error('Send error:', err);
      setError('فشل في إرسال الرد');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Support Tickets List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              تذاكر الدعم المفتوحة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                لا توجد تذاكر دعم مفتوحة
              </p>
            ) : (
              tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTicket?.id === ticket.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => {
                    setSelectedTicket(ticket);
                    generateAISuggestion(ticket);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{ticket.subject}</h4>
                    <Badge
                      className={`${getPriorityColor(ticket.priority)} text-white text-xs`}
                    >
                      {ticket.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                    {ticket.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{ticket.user?.name || 'مستخدم غير معروف'}</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString('ar')}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant Panel */}
      <div className="lg:col-span-2">
        {selectedTicket ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>مساعد الذكاء الاصطناعي</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateAISuggestion(selectedTicket)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  إعادة توليد
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ticket Details */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">{selectedTicket.subject}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {selectedTicket.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>المستخدم: {selectedTicket.user?.name}</span>
                  <span>البريد: {selectedTicket.user?.email}</span>
                  <span>الهاتف: {selectedTicket.user?.phone}</span>
                </div>
              </div>

              {/* AI Suggestion */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span>جارٍ توليد الاقتراح...</span>
                </div>
              ) : aiSuggestion ? (
                <div className="space-y-4">
                  {/* Confidence & Category */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">الثقة:</span>
                      <span className={`font-medium ${getConfidenceColor(aiSuggestion.confidence)}`}>
                        {aiSuggestion.confidence}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">الفئة:</span>
                      <Badge variant="outline">{aiSuggestion.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">الوقت المقدر:</span>
                      <span className="font-medium">{aiSuggestion.estimatedTime} دقيقة</span>
                    </div>
                  </div>

                  {/* Solution */}
                  <div>
                    <h4 className="font-medium mb-2">الحل المقترح:</h4>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">{aiSuggestion.solution}</p>
                    </div>
                  </div>

                  {/* Action Steps */}
                  <div>
                    <h4 className="font-medium mb-2">خطوات الحل:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {aiSuggestion.actions.map((action, index) => (
                        <li key={index} className="text-muted-foreground">{action}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(aiSuggestion.solution)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {copied ? 'تم النسخ!' : 'نسخ الحل'}
                    </Button>
                    <Button
                      onClick={() => sendToUser(selectedTicket.id, aiSuggestion.solution)}
                      size="sm"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      إرسال للمستخدم
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>اختر تذكرة للحصول على اقتراح الذكاء الاصطناعي</p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">اختر تذكرة دعم</h3>
                <p className="text-muted-foreground">
                  اختر تذكرة من القائمة للحصول على مساعدة الذكاء الاصطناعي
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminAIAssistant;