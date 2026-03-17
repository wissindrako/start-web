/**
 * Resizes an image File to a square of the given size using Canvas.
 * Center-crops the image before resizing.
 */
export function resizeImageToSquare(file: File, size: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Center crop: use the smaller dimension as the crop size
      const { naturalWidth: w, naturalHeight: h } = img;
      const minSide = Math.min(w, h);
      const sx = (w - minSide) / 2;
      const sy = (h - minSide) / 2;

      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          resolve(
            new File([blob], `avatar-${size}.webp`, { type: 'image/webp' })
          );
        },
        'image/webp',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}
