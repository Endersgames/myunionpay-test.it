import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera, Keyboard, X, SwitchCamera, FlashlightOff, Flashlight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

export default function ScannerPage() {
  const navigate = useNavigate();
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    if (!showManual) {
      startScanner();
    }
    return () => stopScanner();
  }, [showManual, facingMode]);

  const startScanner = async () => {
    try {
      setCameraError(null);
      
      // Create scanner instance
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader");
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await html5QrCodeRef.current.start(
        { facingMode },
        config,
        onScanSuccess,
        onScanFailure
      );
      
      setScanning(true);
    } catch (err) {
      console.error("Scanner error:", err);
      setCameraError(err.message || "Impossibile accedere alla fotocamera");
      setShowManual(true);
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      console.error("Stop scanner error:", err);
    }
    setScanning(false);
  };

  const onScanSuccess = (decodedText, decodedResult) => {
    console.log("QR Scanned:", decodedText);
    
    // Stop scanner immediately
    stopScanner();
    
    // Parse the QR content
    handleQRContent(decodedText);
  };

  const onScanFailure = (error) => {
    // Silent - this fires constantly when no QR is in view
  };

  const handleQRContent = (content) => {
    // Check if it's a full URL from our app
    if (content.includes("/s/")) {
      // Extract QR code from URL like https://domain.com/s/UP123456
      const match = content.match(/\/s\/([A-Z0-9]+)/i);
      if (match) {
        const qrCode = match[1].toUpperCase();
        toast.success("QR Code rilevato!");
        navigate(`/s/${qrCode}`);
        return;
      }
    }
    
    // Check if it's a payment URL
    if (content.includes("/pay/")) {
      const match = content.match(/\/pay\/([A-Z0-9]+)/i);
      if (match) {
        const qrCode = match[1].toUpperCase();
        toast.success("QR Code rilevato!");
        navigate(`/pay/${qrCode}`);
        return;
      }
    }
    
    // Check if it's just a QR code (UP123456)
    if (content.match(/^UP[A-Z0-9]+$/i)) {
      toast.success("QR Code rilevato!");
      navigate(`/s/${content.toUpperCase()}`);
      return;
    }
    
    // Unknown format
    toast.error("QR Code non riconosciuto");
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error("Inserisci un codice QR");
      return;
    }
    let code = manualCode.trim().toUpperCase();
    
    // Handle full URL
    if (code.includes("/S/") || code.includes("/PAY/")) {
      handleQRContent(code);
      return;
    }
    
    // Add UP prefix if missing
    if (!code.startsWith("UP")) {
      code = "UP" + code;
    }
    
    stopScanner();
    navigate(`/s/${code}`);
  };

  const switchCamera = async () => {
    await stopScanner();
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  return (
    <div className="min-h-screen bg-[#050505] pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => { stopScanner(); navigate("/dashboard"); }}
          className="flex items-center gap-2 text-[#A1A1AA] hover:text-white mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2">Scansiona QR</h1>
        <p className="text-[#A1A1AA]">Inquadra il QR code per pagare</p>
      </div>

      {!showManual ? (
        <div className="px-6 py-4 flex flex-col items-center">
          {/* Scanner Container */}
          <div className="relative w-full max-w-sm mb-6">
            <div className="qr-scanner-frame mx-auto overflow-hidden">
              <div 
                id="qr-reader" 
                ref={scannerRef}
                className="w-full h-full"
                style={{ 
                  width: '274px', 
                  height: '274px',
                  background: '#000'
                }}
              />
              {scanning && <div className="scan-line" />}
            </div>
          </div>

          {/* Camera Error */}
          {cameraError && (
            <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl p-4 mb-4 w-full max-w-sm">
              <p className="text-[#FF3B30] text-sm">{cameraError}</p>
            </div>
          )}

          {/* Instructions */}
          <p className="text-[#A1A1AA] text-center mb-6 max-w-sm">
            {scanning 
              ? "Posiziona il QR code all'interno della cornice" 
              : "Avvio fotocamera..."}
          </p>

          {/* Camera Controls */}
          <div className="flex gap-3 mb-6">
            <Button
              onClick={switchCamera}
              variant="outline"
              className="h-12 px-4 rounded-full border-white/20 bg-[#121212]"
              data-testid="switch-camera-btn"
            >
              <SwitchCamera className="w-5 h-5 mr-2" />
              Cambia Camera
            </Button>
          </div>

          {/* Manual Entry Toggle */}
          <Button
            onClick={() => { stopScanner(); setShowManual(true); }}
            variant="ghost"
            className="text-[#A1A1AA] hover:text-white"
            data-testid="manual-entry-btn"
          >
            <Keyboard className="w-5 h-5 mr-2" />
            Inserisci codice manualmente
          </Button>
        </div>
      ) : (
        <div className="px-6 py-8">
          {/* Manual Entry */}
          <div className="bg-[#121212] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Inserisci Codice QR</h3>
              <button 
                onClick={() => setShowManual(false)}
                className="text-[#A1A1AA] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Input
              placeholder="Es: UP1234ABCD5678"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="h-12 bg-[#050505] border-white/10 focus:border-[#7C3AED] rounded-xl mb-4 font-mono"
              data-testid="manual-code-input"
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <Button
              onClick={handleManualSubmit}
              className="w-full h-12 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9]"
              data-testid="manual-submit-btn"
            >
              Continua
            </Button>
          </div>

          <Button
            onClick={() => setShowManual(false)}
            variant="ghost"
            className="w-full mt-4 text-[#A1A1AA] hover:text-white"
          >
            <Camera className="w-5 h-5 mr-2" />
            Torna alla fotocamera
          </Button>
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
}
