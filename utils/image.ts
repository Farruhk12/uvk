/**
 * Compresses an image file to a base64 string to save storage.
 * @param file The input file object.
 * @param maxWidth Max width of the output image.
 * @param quality JPEG quality (0 to 1).
 */
export const compressImage = (file: File, maxWidth = 800, quality = 0.45): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      if (event.target && event.target.result) {
        img.src = event.target.result as string;
      } else {
        reject(new Error("Image load failed"));
        return;
      }
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = maxWidth;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Could not get canvas context"));
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};