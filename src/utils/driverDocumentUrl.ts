import { supabase } from '@/integrations/supabase/client';

/**
 * يُحوّل مسار ملف (أو URL قديم) في bucket driver-documents إلى signed URL مؤقت.
 * يدعم:
 *   - مسارات نسبية: "user_id/profile.jpg" → signed URL (3600s)
 *   - URLs عامة قديمة (getPublicUrl): يستخرج المسار ويُنشئ signed URL
 *   - URLs كاملة خارجية أو data URIs: يُرجعها كما هي
 *   - null/undefined: يُرجع null
 *
 * @param pathOrUrl المسار أو الرابط المخزّن في عمود drivers.*_image_url
 * @param expiresIn مدة الصلاحية بالثواني (افتراضي: 3600 = ساعة)
 */
export async function getDriverDocumentUrl(
  pathOrUrl: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!pathOrUrl) return null;

  // URLs خارجية أو data URIs — نُرجعها كما هي
  if (pathOrUrl.startsWith('data:')) return pathOrUrl;

  let storagePath = pathOrUrl;
  let targetBucket = 'driver-documents'; // الافتراضي

  // فحص واستخراج الباكيت والمسار إذا كان رابطاً كاملاً من Supabase Storage
  if (pathOrUrl.includes('/storage/v1/object/')) {
    try {
      // الرابط يكون على الشكل: https://.../storage/v1/object/[public|sign]/[bucket-name]/[path/to/file.ext][?token=...]
      const url = new URL(pathOrUrl.startsWith('http') ? pathOrUrl : `${window.location.origin}${pathOrUrl}`);
      const pathname = url.pathname;
      const parts = pathname.split('/storage/v1/object/')[1]?.split('/');
      if (parts && parts.length >= 2) {
        // parts[0] is "public" or "sign"
        // parts[1] is bucket name (e.g. "driver-documents" or "avatars")
        targetBucket = parts[1];
        storagePath = parts.slice(2).join('/');
      }
    } catch (e) {
      console.error('[getDriverDocumentUrl] Error parsing URL:', e);
    }
  } else if (pathOrUrl.startsWith('http')) {
    // URL خارجي آخر — نُرجعه كما هو
    return pathOrUrl;
  } else {
    // إذا كان مساراً نسبياً فقط
    if (pathOrUrl.includes('avatars/') || pathOrUrl.includes('drivers/')) {
      targetBucket = 'avatars';
    }
  }

  // إزالة أي query parameters مثل ?token=... من مسار الملف
  storagePath = storagePath.split('?')[0];

  // إذا كان الباكيت المستهدف هو avatars وهو باكيت عام (Public Bucket)
  // نُرجع الرابط العام مباشرة وبسرعة لتوفير API Calls
  if (targetBucket === 'avatars') {
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath);
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  }

  // للمستندات الخاصة في driver-documents، ننشئ signed URL
  const { data, error } = await supabase.storage
    .from(targetBucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn(`[getDriverDocumentUrl] Failed to create signed URL from ${targetBucket}:`, storagePath, error);
    
    // محاولة الحصول على رابط عام من avatars كـ fallback احتياطي
    const { data: avatarData } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath);
    if (avatarData?.publicUrl) {
      return avatarData.publicUrl;
    }
    return null;
  }

  return data.signedUrl;
}

/**
 * يُحوّل مجموعة مسارات بالتوازي إلى signed URLs.
 * مفيد لعرض كل وثائق سائق واحد دفعة واحدة.
 */
export async function getDriverDocumentUrls(
  paths: Record<string, string | null | undefined>,
  expiresIn = 3600,
): Promise<Record<string, string | null>> {
  const entries = Object.entries(paths);
  const results = await Promise.all(
    entries.map(async ([key, path]) => {
      const url = await getDriverDocumentUrl(path, expiresIn);
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(results);
}
