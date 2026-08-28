/**
 * Helper to compress and resize images before saving to LocalStorage or Supabase
 * Prevents LocalStorage QuotaExceededError and optimizes network transfer
 */
export async function compressImageFile(
  file: File | Blob,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new aspect-ratio preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Draw image with smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Format bytes into human readable string (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Helper to process any uploaded file into data URL and metadata
 */
export async function processUploadedFile(file: File): Promise<{
  dataUrl: string;
  name: string;
  type: 'image' | 'file' | 'drive' | 'url';
  sizeString: string;
}> {
  const isImage = file.type.startsWith('image/');
  let dataUrl = '';

  if (isImage) {
    dataUrl = await compressImageFile(file, 900, 900, 0.85);
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Remove extension from display name if desired or keep clean name
  const cleanName = file.name.replace(/\.[^/.]+$/, "") || file.name;

  return {
    dataUrl,
    name: cleanName,
    type: isImage ? 'image' : 'file',
    sizeString: formatBytes(file.size),
  };
}

