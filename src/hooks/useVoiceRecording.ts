/**
 * ران - Voice Recording Hook
 * تسجيل الصوت وإرساله لـ Edge Function للتحويل والتحليل
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
    setAmplitude(Math.min(rms * 3, 1)); // تطبيع بين 0 و 1

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
      mediaRecorder.start(100); // جمع البيانات كل 100ms
      setVoiceState('recording');

      // بدء مراقبة مستوى الصوت
      monitorAmplitude();
    } catch (err) {
      console.error('Voice recording error:', err);
      setError('لم نتمكن من الوصول للمايكروفون. يرجى السماح بالوصول.');
      setVoiceState('error');
    }
  }, [monitorAmplitude]);

  // إيقاف التسجيل والمعالجة
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

        // التحقق من الحد الأدنى لحجم الملف
        if (audioBlob.size < 1000) {
          setError('التسجيل قصير جداً. حاول مرة أخرى.');
          setVoiceState('error');
          resolve(null);
          return;
        }

        setVoiceState('processing');

        try {
          // تحويل إلى base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((res) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              res(base64);
            };
          });
          reader.readAsDataURL(audioBlob);
          const audioBase64 = await base64Promise;

          // إرسال إلى Edge Function
          const { data, error: fnError } = await supabase.functions.invoke('voice-booking-ai', {
            body: {
              audio: audioBase64,
              mimeType: 'audio/webm',
            },
          });

          if (fnError) throw fnError;

          const voiceResult: VoiceResult = {
            transcript: data.transcript || '',
            origin: data.origin || null,
            destination: data.destination || null,
            vehicleType: data.vehicleType || 'economy',
          };

          setResult(voiceResult);
          setVoiceState('success');
          resolve(voiceResult);
        } catch (err) {
          console.error('Voice processing error:', err);
          setError('حدث خطأ أثناء معالجة الصوت. حاول مرة أخرى.');
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
