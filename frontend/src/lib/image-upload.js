const DEFAULT_MAX_BYTES = 850 * 1024;
const DEFAULT_MAX_DIMENSION = 1800;
const DEFAULT_QUALITY = 0.82;
const MIN_QUALITY = 0.45;
const QUALITY_STEP = 0.08;
const DIMENSION_STEP = 0.85;

const isBrowser = typeof window !== "undefined";

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossibile leggere l'immagine selezionata."));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Impossibile preparare l'immagine per l'upload."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const getOutputName = (filename) => {
  const baseName = (filename || "upload").replace(/\.[^.]+$/, "");
  return `${baseName}.jpg`;
};

export async function optimizeImageForUpload(
  file,
  {
    maxBytes = DEFAULT_MAX_BYTES,
    maxDimension = DEFAULT_MAX_DIMENSION,
    initialQuality = DEFAULT_QUALITY,
  } = {},
) {
  if (!isBrowser || !(file instanceof File) || !file.type.startsWith("image/")) {
    return file;
  }

  if (file.size <= maxBytes && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }

  let image;
  try {
    image = await loadImage(file);
  } catch (_) {
    return file;
  }

  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  const longestSide = Math.max(width, height);

  if (longestSide > maxDimension) {
    const scale = maxDimension / longestSide;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  let quality = initialQuality;
  let bestBlob = null;

  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let currentQuality = quality;
    while (currentQuality >= MIN_QUALITY) {
      const blob = await canvasToBlob(canvas, "image/jpeg", currentQuality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= maxBytes) {
        return new File([blob], getOutputName(file.name), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
      currentQuality -= QUALITY_STEP;
    }

    const nextWidth = Math.round(width * DIMENSION_STEP);
    const nextHeight = Math.round(height * DIMENSION_STEP);
    if (nextWidth >= width || nextHeight >= height || nextWidth < 320 || nextHeight < 320) {
      break;
    }
    width = nextWidth;
    height = nextHeight;
    quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
  }

  if (bestBlob && bestBlob.size < file.size) {
    return new File([bestBlob], getOutputName(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  return file;
}
