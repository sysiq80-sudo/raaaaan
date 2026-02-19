/**
 * ران - Voice Recording Hook v3
 * تسجيل الصوت وإرساله للتحليل بالذكاء الاصطناعي
 * 
 * استراتيجية مزدوجة: FormData أولاً → إذا فشل يحاول base64 JSON تلقائياً
 * مهلة 20 ثانية لكل محاولة — لا يبقى عالقاً أبداً
 */

import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export interface VoiceResult {
  transcript: string;
  origin: { lat: number; lng: number; name: string } | null;
  destination: { lat: number; lng: number; name: string } | null;
  vehicleType: 'economy' | 'comfort' | 'premium' | 'women_only';
}

// مهلة لكل محاولة (20 ثانية)
const INVOKE_TIMEOUT_MS = 20_000;

/**
 * Helper: إرسال الطلب للـ Edge Function مع مهلة
 * يرجع الـ data أو يرمي خطأ
 */
async function invokeVoiceAI(
  body: FormData | string,
  headers?: Record<string, string>,
): Promise<Record<string, any>> {
  const invokePromise = supabase.functions.invoke('voice-booking-ai', {
    body,
    ...(headers ? { headers } : {}),
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), INVOKE_TIMEOUT_MS),
  );

  const { data, error: fnError } = await Promise.race([invokePromise, timeoutPromise]);

  if (fnError) {
    // استخراج رسالة الخطأ الحقيقية من استجابة الـ Edge Function
    let errorMsg = fnError.message || 'Unknown error';
    if (fnError.context) {
      try {
        const body = await fnError.context.json();
        errorMsg = body?.error || errorMsg;
      } catch { /* الاستجابة ليست JSON */ }
    }
    throw new Error(errorMsg);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * تحويل Blob إلى base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // إزالة data:...;base64, prefix
      const base64 = result.split(',')[1];
      if (!base64) return reject(new Error('Failed to convert blob to base64'));
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const useVoiceRecording = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amplitude, setAmplitude] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // مراقبة مستوى الصوت للتأثير البصري
  const monitorAmplitude = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);

    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / data.length);
    setAmplitude(Math.min(rms * 3, 1));

    animFrameRef.current = requestAnimationFrame(monitorAmplitude);
  }, []);

  // بدء التسجيل
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setResult(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      // إعداد محلل الصوت للتأثير البصري
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // بدء تسجيل الصوت
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setVoiceState('recording');

      // بدء مراقبة مستوى الصوت
      monitorAmplitude();
    } catch (err) {
      console.error('[VoiceRecording] Mic access error:', err);
      setError('لم نتمكن من الوصول للمايكروفون. يرجى السماح بالوصول.');
      setVoiceState('error');
    }
  }, [monitorAmplitude]);

  // ===================================================================
  // إيقاف التسجيل → إرسال الصوت → تحليل بالذكاء الاصطناعي
  // استراتيجية مزدوجة: FormData أولاً → base64 JSON كخطة بديلة
  // ===================================================================
  const stopRecording = useCallback(async () => {
    return new Promise<VoiceResult | null>((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      // إيقاف مراقبة السعة
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setAmplitude(0);

      mediaRecorderRef.current.onstop = async () => {
        // إيقاف البث
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // التحقق من الحد الأدنى لحجم الملف (< 1KB = تسجيل فارغ)
        if (audioBlob.size < 1000) {
          setError('التسجيل قصير جداً. حاول مرة أخرى.');
          setVoiceState('error');
          resolve(null);
          return;
        }

        setVoiceState('processing');
        const sizeKB = Math.round(audioBlob.size / 1024);
        console.log(`[VoiceRecording] Audio ready: ${sizeKB}KB, type: ${audioBlob.type}`);

        try {
          let data: Record<string, any> | null = null;

          // ═══════════════════════════════════════════
          // المحاولة 1: FormData (الأسرع والأصغر حجماً)
          // ═══════════════════════════════════════════
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            console.log('[VoiceRecording] Strategy 1: FormData upload...');
            data = await invokeVoiceAI(formData);
            console.log('[VoiceRecording] ✅ FormData succeeded');
          } catch (formErr: any) {
            console.warn(`[VoiceRecording] ❌ FormData failed: ${formErr.message}`);

            // ═══════════════════════════════════════════
            // المحاولة 2: base64 JSON (أكثر توافقاً)
            // بعض البيئات/الـ proxies لا تمرر FormData بشكل صحيح
            // ═══════════════════════════════════════════
            if (formErr.message !== 'TIMEOUT') {
              try {
                console.log('[VoiceRecording] Strategy 2: base64 JSON fallback...');
                const base64Audio = await blobToBase64(audioBlob);
                const jsonBody = JSON.stringify({
                  audio: base64Audio,
                  mimeType: audioBlob.type || 'audio/webm',
                });
                data = await invokeVoiceAI(jsonBody, { 'Content-Type': 'application/json' });
                console.log('[VoiceRecording] ✅ base64 JSON succeeded');
              } catch (b64Err: any) {
                console.error(`[VoiceRecording] ❌ base64 also failed: ${b64Err.message}`);
                throw b64Err; // كلا الطريقتين فشلتا
              }
            } else {
              throw formErr; // مهلة — لا فائدة من إعادة المحاولة
            }
          }

          if (!data) {
            throw new Error('لا استجابة من الخادم');
          }

          console.log('[VoiceRecording] Result:', JSON.stringify(data));

          const voiceResult: VoiceResult = {
            transcript: data.transcript || '',
            origin: data.origin || null,
            destination: data.destination || null,
            vehicleType: data.vehicleType || 'economy',
          };

          // التحقق من وجود نتيجة مفيدة
          if (!voiceResult.transcript && !voiceResult.destination) {
            throw new Error('لم نتمكن من فهم الكلام. حاول مرة أخرى بصوت أوضح.');
          }

          setResult(voiceResult);
          setVoiceState('success');
          resolve(voiceResult);
        } catch (err: any) {
          console.error('[VoiceRecording] Final error:', err.message);

          // رسائل خطأ واضحة بالعربية حسب نوع الخطأ
          let userMessage: string;
          if (err.message === 'TIMEOUT') {
            userMessage = 'الاتصال بطيء جداً. تأكد من اتصال الإنترنت وحاول مرة أخرى.';
          } else if (err.message.includes('Whisper') || err.message.includes('تحويل الصوت')) {
            userMessage = 'لم يتم التعرف على الصوت. تأكد من التحدث بوضوح وحاول مرة أخرى.';
          } else if (err.message.includes('فهم الكلام')) {
            userMessage = err.message;
          } else {
            userMessage = 'حدث خطأ أثناء معالجة الصوت. حاول مرة أخرى.';
          }

          setError(userMessage);
          setVoiceState('error');
          resolve(null);
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  // إلغاء التسجيل
  const cancelRecording = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setAmplitude(0);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    chunksRef.current = [];
    setVoiceState('idle');
    setError(null);
  }, []);

  // إعادة التعيين
  const resetVoice = useCallback(() => {
    cancelRecording();
    setResult(null);
    setError(null);
    setVoiceState('idle');
  }, [cancelRecording]);

  return {
    voiceState,
    result,
    error,
    amplitude,
    startRecording,
    stopRecording,
    cancelRecording,
    resetVoice,
  };
};
