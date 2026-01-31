import { QRCodeSVG } from "qrcode.react";

/**
 * QRCode component that generates real, scannable QR codes
 * 
 * The QR contains an intent URL that:
 * - On Android: Forces opening with Chrome
 * - On iOS/Desktop: Opens normally in browser
 * 
 * @param {string} value - The QR code identifier (e.g., UP123456)
 * @param {number} size - Size in pixels
 */
export const QRCode = ({ value, size = 200 }) => {
  // Get the production URL from environment
  const getBaseUrl = () => {
    const envUrl = process.env.REACT_APP_BACKEND_URL;
    if (envUrl) {
      return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
    return window.location.origin;
  };

  const baseUrl = getBaseUrl();
  
  // Create intent URL that forces Chrome on Android
  // Format: intent://HOST/PATH#Intent;scheme=https;package=com.android.chrome;end
  const urlPath = `/s/${value}`;
  const host = baseUrl.replace('https://', '').replace('http://', '');
  
  // Use intent URL for Android Chrome, fallback to normal URL
  const intentUrl = `intent://${host}${urlPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(baseUrl + urlPath)};end`;
  
  // For QR we use the intent URL which works on Android
  // On iOS/desktop it will use the fallback URL
  const qrContent = intentUrl;

  return (
    <div data-testid="qr-code-container">
      <QRCodeSVG
        value={qrContent}
        size={size}
        level="M" // Medium error correction (intent URLs are long)
        includeMargin={false}
        bgColor="#FFFFFF"
        fgColor="#000000"
        data-testid="qr-canvas"
      />
    </div>
  );
};

export default QRCode;
