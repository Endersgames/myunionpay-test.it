import { QRCodeSVG } from "qrcode.react";

/**
 * QRCode component that generates real, scannable QR codes
 * 
 * The QR code contains a smart URL that:
 * - If user is logged in → opens payment page
 * - If user is NOT logged in → opens registration with referral
 * 
 * @param {string} value - The QR code identifier (e.g., UP123456)
 * @param {number} size - Size in pixels
 */
export const QRCode = ({ value, size = 200 }) => {
  // Get the production URL from environment or fallback to window.location.origin
  const getBaseUrl = () => {
    // In production, use the backend URL which is the same domain
    const envUrl = process.env.REACT_APP_BACKEND_URL;
    if (envUrl) {
      // Remove /api suffix if present and extract base domain
      return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
    // Fallback to current origin
    return window.location.origin;
  };

  const baseUrl = getBaseUrl();
  const qrContent = `${baseUrl}/s/${value}`;

  return (
    <div data-testid="qr-code-container">
      <QRCodeSVG
        value={qrContent}
        size={size}
        level="H" // High error correction for better scanning
        includeMargin={false}
        bgColor="#FFFFFF"
        fgColor="#000000"
        data-testid="qr-canvas"
      />
    </div>
  );
};

export default QRCode;
