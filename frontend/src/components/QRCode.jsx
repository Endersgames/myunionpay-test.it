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
  // Always use the current domain for QR codes
  // This ensures QR codes work on any domain (preview, custom, localhost)
  const qrContent = `${window.location.origin}/s/${value}`;

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
