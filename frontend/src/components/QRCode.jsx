import { useEffect, useState } from "react";
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
  const [qrContent, setQrContent] = useState("");

  useEffect(() => {
    setQrContent(`${window.location.origin}/s/${value}`);
  }, [value]);

  return (
    <div data-testid="qr-code-container">
      {qrContent ? (
        <QRCodeSVG
          value={qrContent}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#FFFFFF"
          fgColor="#000000"
          data-testid="qr-canvas"
        />
      ) : (
        <div
          className="rounded-2xl bg-[#F5F5F5] animate-pulse"
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
};

export default QRCode;
