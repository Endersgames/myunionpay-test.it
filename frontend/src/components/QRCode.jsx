import { QRCodeSVG } from "qrcode.react";

/**
 * QRCode component that generates real, scannable QR codes
 * 
 * @param {string} value - The QR code identifier (e.g., UP123456 or REF123)
 * @param {number} size - Size in pixels
 * @param {string} type - "payment" | "referral" - determines the URL structure
 */
export const QRCode = ({ value, size = 200, type = "payment" }) => {
  // Generate the full URL that the QR code will encode
  const baseUrl = window.location.origin;
  
  let qrContent;
  if (type === "referral") {
    // Referral QR encodes registration URL with referral code
    qrContent = `${baseUrl}/register?ref=${value}`;
  } else {
    // Payment QR encodes payment URL with user's QR code
    qrContent = `${baseUrl}/pay/${value}`;
  }

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
