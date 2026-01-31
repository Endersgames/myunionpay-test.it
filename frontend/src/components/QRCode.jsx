import { useEffect, useRef } from "react";

export const QRCode = ({ value, size = 200 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Simple QR-like pattern generator (visual representation)
    // In production, use a proper QR library
    const moduleCount = 21;
    const moduleSize = size / moduleCount;
    
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = "#000000";
    
    // Generate deterministic pattern from value
    const seed = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Draw finder patterns (corners)
    const drawFinderPattern = (x, y) => {
      // Outer
      ctx.fillRect(x * moduleSize, y * moduleSize, 7 * moduleSize, 7 * moduleSize);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect((x + 1) * moduleSize, (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
    };
    
    drawFinderPattern(0, 0);
    drawFinderPattern(moduleCount - 7, 0);
    drawFinderPattern(0, moduleCount - 7);
    
    // Draw data modules
    for (let i = 0; i < moduleCount; i++) {
      for (let j = 0; j < moduleCount; j++) {
        // Skip finder patterns
        if ((i < 8 && j < 8) || (i < 8 && j > moduleCount - 9) || (i > moduleCount - 9 && j < 8)) continue;
        
        // Generate pseudo-random pattern
        const hash = (i * 31 + j * 17 + seed) % 100;
        if (hash < 45) {
          ctx.fillRect(i * moduleSize, j * moduleSize, moduleSize, moduleSize);
        }
      }
    }
    
    // Draw timing patterns
    for (let i = 8; i < moduleCount - 8; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(6 * moduleSize, i * moduleSize, moduleSize, moduleSize);
        ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
      }
    }
    
  }, [value, size]);

  return (
    <canvas 
      ref={canvasRef} 
      width={size} 
      height={size}
      className="rounded-lg"
      data-testid="qr-canvas"
    />
  );
};

export default QRCode;
