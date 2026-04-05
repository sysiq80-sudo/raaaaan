/**
 * ران - Hook البحث الصوتي
 * يستخدم Web Speech API للتعرف على الكلام بالعربية العراقية
 * يدعم: ar-IQ (عربي عراقي)، ar (عربي عام)، en (إنجليزي)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface UseVoiceSearchOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  maxDuration?: number; // بالمللي ثانية — الحد الأقصى للاستماع
}

interface UseVoiceSearchReturn {
  isSupported: boolean;
  voiceState: VoiceState;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

// تحقق من دعم المتصفح
const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

export const useVoiceSearch = ({
  lang = 'ar-IQ',
  onResult,
  onError,
  continuous = false,
  maxDuration = 10000,
}: UseVoiceSearchOptions = {}): UseVoiceSearchReturn => {
  const SpeechRecognitionClass = getSpeechRecognition();
  const isSupported = !!SpeechRecognitionClass;

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تنظيف عند unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const stopListening = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setVoiceState('idle');
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) {
      onError?.('المتصفح لا يدعم التعرف على الصوت');
      return;
    }

    // إيقاف أي جلسة سابقة
    recognitionRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState('listening');
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      if (finalTranscript) {
        setVoiceState('processing');
        onResult?.(finalTranscript.trim());
        // إيقاف بعد النتيجة النهائية (غير مستمر)
        if (!continuous) {
          setTimeout(() => setVoiceState('idle'), 300);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMap: Record<string, string> = {
        'no-speech': 'لم يتم اكتشاف صوت، حاول مرة أخرى',
        'audio-capture': 'لا يمكن الوصول للميكروفون',
        'not-allowed': 'تم رفض إذن الميكروفون',
        'network': 'خطأ في الشبكة',
        'aborted': '',
      };
      const msg = errorMap[event.error] || `خطأ: ${event.error}`;
      if (msg) {
        setVoiceState('error');
        onError?.(msg);
        setTimeout(() => setVoiceState('idle'), 2000);
      } else {
        setVoiceState('idle');
      }
    };

    recognition.onend = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // لا نعيد إلى idle هنا — onsresult أو onerror يتحكمان بالحالة
      if (voiceState === 'listening') {
        setVoiceState('idle');
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      // حد أقصى للاستماع
      timeoutRef.current = setTimeout(() => {
        stopListening();
      }, maxDuration);
    } catch (err) {
      setVoiceState('error');
      onError?.('فشل في بدء التعرف الصوتي');
      setTimeout(() => setVoiceState('idle'), 2000);
    }
  }, [SpeechRecognitionClass, lang, continuous, maxDuration, onResult, onError, stopListening, voiceState]);

  const toggleListening = useCallback(() => {
    if (voiceState === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceState, startListening, stopListening]);

  return {
    isSupported,
    voiceState,
    transcript,
    startListening,
    stopListening,
    toggleListening,
  };
};
