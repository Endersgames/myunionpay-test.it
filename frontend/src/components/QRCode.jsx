import { QRCodeSVG } from "qrcode.react";

/**
 * QRCode component that generates real, scannable QR codes
 * 
 * The QR contains a direct URL to the smart redirect page
 * Browser detection and Chrome prompt happens on page load
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
  
  // Simple, scannable URL
  const qrContent = `${baseUrl}/s/${value}`;

  return (
    <div data-testid="qr-code-container">
      <QRCodeSVG
        value={qrContent}
        size={size}
        level="H" // High error correction
        includeMargin={false}
        bgColor="#FFFFFF"
        fgColor="#000000"
        data-testid="qr-canvas"
      />
    </div>
  );
};

export default QRCode;
