/**
 * Compresses an image file to a maximum width/height and quality.
 * Returns a Blob.
 */
export const compressImage = async (file: File, maxWidth = 800, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        ctx.canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas to Blob failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const sanitizeFileName = (name: string): string => {
  const base = name.replace(/\.[^/.]+$/, '');
  const cleaned = base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 100);
};

export const validateImageFile = (
  file: File,
  maxBytes: number = 8 * 1024 * 1024,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']
): { ok: boolean; error?: string } => {
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: 'Unsupported image type' };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: 'Image too large' };
  }
  return { ok: true };
};
