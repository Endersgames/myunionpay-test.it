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
  // Generate the smart URL - /s/ route handles the logic
  const baseUrl = window.location.origin;
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
