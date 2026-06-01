/**
 * ضغط الصور قبل الرفع — يقلل حجم الصور بنسبة 70-90%
 *
 * يستخدم Canvas API (متوفر في كل المتصفحات + Capacitor WebView)
 * بدون مكتبات خارجية.
 *
 * - يُقلص الأبعاد لحد أقصى (افتراضي 1024px)
 * - يحوّل لـ JPEG بجودة 0.8
 * - يدعم HEIC/PNG/JPEG/WebP
 */

interface CompressOptions {
  /** الحد الأقصى لعرض أو ارتفاع الصورة بالبكسل */
  maxDimension?: number;
  /** جودة JPEG (0-1) — افتراضي 0.8 */
  quality?: number;
  /** نوع الخرج — افتراضي image/jpeg */
  outputType?: 'image/jpeg' | 'image/webp';
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const {
    maxDimension = 1024,
    quality = 0.8,
    outputType = 'image/jpeg',
  } = options;

  // إذا كان الملف صغير أصلاً (<200KB) — لا داعي للضغط
  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // تقليص الأبعاد مع الحفاظ على النسبة
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // fallback: أرجع الأصل
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // الاسم الجديد مع الامتداد الصحيح
          const ext = outputType === 'image/webp' ? '.webp' : '.jpg';
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFile = new File([blob], `${baseName}${ext}`, {
            type: outputType,
            lastModified: Date.now(),
          });

          console.log(
            `[compressImage] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% savings)`,
          );

          resolve(compressedFile);
        },
        outputType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: أرجع الأصل عند فشل القراءة
    };

    img.src = url;
  });
}
