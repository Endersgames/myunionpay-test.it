import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

export default function ScannerPage() {
  const navigate = useNavigate();
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!showManual) {
      startCamera();
    }
    return () => stopCamera();
  }, [showManual]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setScanning(true);
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Impossibile accedere alla fotocamera");
      setShowManual(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      toast.error("Inserisci un codice QR");
      return;
    }
    const code = manualCode.trim().toUpperCase();
    if (!code.startsWith("UP")) {
      toast.error("Codice QR non valido");
      return;
    }
    stopCamera();
    navigate(`/pay/${code}`);
  };

  // Simulated QR detection (in production use a real QR scanner library)
  const simulateScan = () => {
    const demoCode = "UPTEST123456";
    toast.success("QR Code rilevato!");
    stopCamera();
    navigate(`/pay/${demoCode}`);
  };

  return (
    <div className="min-h-screen bg-[#050505] pb-safe">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <button 
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-[#A1A1AA] hover:text-white mb-6 transition-colors"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Dashboard</span>
        </button>

        <h1 className="font-heading text-2xl font-bold mb-2">Scansiona QR</h1>
        <p className="text-[#A1A1AA]">Inquadra il QR code per pagare</p>
      </div>

      {/* Scanner/Manual Toggle */}
      {!showManual ? (
        <div className="px-6 py-8 flex flex-col items-center">
          {/* Camera Preview */}
          <div className="qr-scanner-frame mb-8" data-testid="scanner-frame">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover rounded-[21px]"
            />
            <div className="scan-line" />
          </div>

          <p className="text-[#A1A1AA] text-center mb-6">
            Posiziona il QR code all'interno della cornice
          </p>

          {/* Demo button for testing */}
          <Button
            onClick={simulateScan}
            className="w-full max-w-sm h-12 rounded-full bg-[#121212] border border-white/10 hover:border-[#7C3AED]/50 mb-4"
            data-testid="demo-scan-btn"
          >
            <Camera className="w-5 h-5 mr-2" />
            Simula Scansione (Demo)
          </Button>

          <Button
            onClick={() => { stopCamera(); setShowManual(true); }}
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
