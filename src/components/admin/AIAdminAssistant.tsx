/**
 * ران - مساعد الأدمن الذكي
 * زر عائم للدردشة مع DeepSeek AI
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
    Bot,
    X,
    Send,
    Loader2,
    Sparkles,
    BarChart3,
    Trash2,
    Minimize2,
    Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

const QUICK_PROMPTS = [
    { label: "📊 إحصائيات اليوم", prompt: "أعطني ملخص إحصائيات اليوم" },
    { label: "🚗 السائقين المتصلين", prompt: "كم سائق متصل حالياً؟" },
    { label: "📈 تحليل الأداء", prompt: "حلل أداء النظام هذا الأسبوع" },
    { label: "❓ مساعدة", prompt: "كيف يمكنني استخدام لوحة التحكم بشكل أفضل؟" },
];

const AIAdminAssistant = () => {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [includeStats, setIncludeStats] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
            inputRef.current?.focus();
        }
    }, [isOpen, isMinimized, messages]);

    // Load messages from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("ai-assistant-messages");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setMessages(parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                })));
            } catch (e) {
                console.error("Error loading messages:", e);
            }
        }
    }, []);

    // Save messages to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem("ai-assistant-messages", JSON.stringify(messages));
        }
    }, [messages]);

    // Clear chat
    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem("ai-assistant-messages");
    };

    // Send message
    const handleSend = async (customPrompt?: string) => {
        const messageText = customPrompt || input.trim();
        if (!messageText || loading) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: messageText,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            // Get auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("غير مسجل الدخول");
            }

            // Prepare messages history (last 10 for context)
            const historyMessages = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));

            // Call Edge Function
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || "https://wgolkcztdrwdphwjvqxt.supabase.co"}/functions/v1/super-function`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        messages: [...historyMessages, { role: "user", content: messageText }],
                        includeStats
                    })
                }
            );

            const data = await response.json();

            if (data.error && !data.assistant_message) {
                throw new Error(data.error);
            }

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.assistant_message || "عذراً، لم أتمكن من الإجابة.",
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error: any) {
            console.error("AI Assistant error:", error);

            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `⚠️ ${error.message || "حدث خطأ في الاتصال بالمساعد الذكي"}`,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, errorMessage]);

            toast({
                title: "خطأ",
                description: error.message || "فشل الاتصال بالمساعد الذكي",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    // Format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <>
            {/* Floating Button */}
            <motion.div
                className="fixed bottom-6 left-6 z-50"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
            >
                <Button
                    size="lg"
                    className={cn(
                        "w-14 h-14 rounded-full shadow-lg transition-all duration-300",
                        isOpen
                            ? "bg-destructive hover:bg-destructive/90"
                            : "bg-gradient-to-r from-primary to-blue-600 hover:shadow-xl hover:scale-105"
                    )}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? (
                        <X className="w-6 h-6" />
                    ) : (
                        <Bot className="w-6 h-6" />
                    )}
                </Button>

                {/* Notification dot */}
                {!isOpen && messages.length === 0 && (
                    <motion.div
                        className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                )}
            </motion.div>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={cn(
                            "fixed z-50 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden",
                            isMinimized
                                ? "bottom-6 left-24 w-64 h-14"
                                : "bottom-24 left-6 w-96 h-[500px]"
                        )}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ type: "spring", damping: 25 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-blue-600 text-white">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                <span className="font-bold">مساعد ران الذكي</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {!isMinimized && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                                            onClick={clearChat}
                                            title="مسح المحادثة"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-8 w-8 hover:bg-white/20",
                                                includeStats ? "text-amber-300" : "text-white/50"
                                            )}
                                            onClick={() => setIncludeStats(!includeStats)}
                                            title={includeStats ? "الإحصائيات مفعلة" : "الإحصائيات معطلة"}
                                        >
                                            <BarChart3 className="w-4 h-4" />
                                        </Button>
                                    </>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                >
                                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        {!isMinimized && (
                            <>
                                {/* Messages */}
                                <div className="h-[340px] overflow-y-auto p-4 space-y-3 bg-muted/30">
                                    {messages.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Bot className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                                            <p className="text-muted-foreground mb-4">مرحباً! كيف أساعدك اليوم؟</p>

                                            {/* Quick prompts */}
                                            <div className="grid grid-cols-2 gap-2 px-2">
                                                {QUICK_PROMPTS.map((item, i) => (
                                                    <Button
                                                        key={i}
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-auto py-2 whitespace-normal"
                                                        onClick={() => handleSend(item.prompt)}
                                                    >
                                                        {item.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {messages.map((msg) => (
                                                <motion.div
                                                    key={msg.id}
                                                    className={cn(
                                                        "flex",
                                                        msg.role === "user" ? "justify-end" : "justify-start"
                                                    )}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                >
                                                    <div
                                                        className={cn(
                                                            "max-w-[85%] rounded-2xl px-4 py-2",
                                                            msg.role === "user"
                                                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                                                : "bg-card border border-border rounded-bl-sm"
                                                        )}
                                                    >
                                                        {msg.role === "assistant" && (
                                                            <div className="flex items-center gap-1 mb-1 text-primary">
                                                                <Sparkles className="w-3 h-3" />
                                                                <span className="text-xs font-medium">المساعد</span>
                                                            </div>
                                                        )}
                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                        <p className={cn(
                                                            "text-[10px] mt-1",
                                                            msg.role === "user" ? "text-white/60" : "text-muted-foreground"
                                                        )}>
                                                            {formatTime(msg.timestamp)}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))}

                                            {loading && (
                                                <div className="flex justify-start">
                                                    <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span className="text-sm">جاري التفكير...</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={messagesEndRef} />
                                        </>
                                    )}
                                </div>

                                {/* Input */}
                                <div className="p-3 border-t border-border bg-card">
                                    <form
                                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                                        className="flex items-center gap-2"
                                    >
                                        <Input
                                            ref={inputRef}
                                            type="text"
                                            placeholder="اسأل أي سؤال..."
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            className="flex-1 rounded-full bg-muted border-0"
                                            disabled={loading}
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            className="rounded-full shrink-0"
                                            disabled={!input.trim() || loading}
                                        >
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </form>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AIAdminAssistant;
