"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const containerId = "reader";
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize the instance once if it doesn't exist
    if (!qrCodeRef.current) {
      qrCodeRef.current = new Html5Qrcode(containerId);
    }

    // Auto-start on mount
    startScanner();

    return () => {
      // Clean shutdown on unmount
      if (qrCodeRef.current) {
        if (qrCodeRef.current.isScanning) {
          qrCodeRef.current.stop().catch((err) => console.error("Failed to stop scanner on unmount", err));
        }
      }
    };
  }, []);

  const startScanner = async () => {
    if (!qrCodeRef.current) return;
    
    // Prevent double start
    if (qrCodeRef.current.isScanning) return;

    try {
      setError(null);
      await qrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          stopScanner().then(() => {
            onScanSuccess(decodedText);
          });
        },
        () => {}
      );
      setIsStarted(true);
    } catch (err: any) {
      console.error("Failed to start scanner:", err);
      setError("Failed to access camera. Please ensure camera permissions are granted.");
      setIsStarted(false);
    }
  };

  const stopScanner = async () => {
    if (qrCodeRef.current && qrCodeRef.current.isScanning) {
      try {
        await qrCodeRef.current.stop();
        setIsStarted(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !qrCodeRef.current) return;

    try {
      setError(null);
      // Stop camera if it's running before scanning file
      if (qrCodeRef.current.isScanning) {
        await stopScanner();
      }
      
      const decodedText = await qrCodeRef.current.scanFile(file, true);
      onScanSuccess(decodedText);
    } catch (err) {
      console.error("File scan error:", err);
      setError("Failed to read QR Code from image. Please ensure the image is clear.");
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-lg overflow-hidden relative shadow-md p-2">
      {error && (
        <div className="p-2 mb-2 text-sm text-red-600 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      )}

      <div 
        id={containerId} 
        className="w-full bg-black rounded-lg overflow-hidden flex items-center justify-center"
        style={{ minHeight: "250px", aspectRatio: "1/1" }}
      ></div>

      <div className="mt-4 flex flex-col gap-2">
        {!isStarted ? (
          <button
            onClick={startScanner}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition active:scale-95"
          >
            Start Scanning
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition active:scale-95"
          >
            Stop Scanning
          </button>
        )}
        
        <div className="relative mt-1">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <span>📁</span> Upload QR Image
          </button>
        </div>
      </div>

      <style jsx global>{`
        #${containerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.5rem;
        }
        #${containerId} canvas {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
