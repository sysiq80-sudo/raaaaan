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

  // إذا كان URL كامل من Supabase Storage (قديم من getPublicUrl)
  // نستخرج المسار النسبي
  if (pathOrUrl.includes('/storage/v1/object/public/driver-documents/')) {
    storagePath = pathOrUrl.split('/storage/v1/object/public/driver-documents/')[1];
  } else if (pathOrUrl.startsWith('http')) {
    // URL خارجي آخر — نُرجعه كما هو
    return pathOrUrl;
  }

  // إنشاء signed URL
  const { data, error } = await supabase.storage
    .from('driver-documents')
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn('[getDriverDocumentUrl] Failed to create signed URL:', storagePath, error);
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
