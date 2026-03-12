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

  useEffect(() => {
    // Initialize the instance once
    qrCodeRef.current = new Html5Qrcode(containerId);

    // Auto-start on mount
    startScanner();

    return () => {
      // Clean shutdown on unmount
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        qrCodeRef.current
          .stop()
          .then(() => {
            qrCodeRef.current?.clear();
          })
          .catch((err) => console.error("Failed to stop scanner on unmount", err));
      }
    };
  }, []);

  const startScanner = async () => {
    if (!qrCodeRef.current) return;

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
          // Success callback
          stopScanner().then(() => {
            onScanSuccess(decodedText);
          });
        },
        () => {
          // Scanning error callback (ignored to avoid spam)
        }
      );
      setIsStarted(true);
    } catch (err: any) {
      console.error("Failed to start scanner:", err);
      setError("Gagal mengakses kamera. Pastikan izin diberikan.");
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

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-lg overflow-hidden relative shadow-md p-2">
      {error && (
        <div className="p-2 mb-2 text-sm text-red-600 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      )}

      <div 
        id={containerId} 
        className="w-full bg-black rounded-lg overflow-hidden"
        style={{ minHeight: "250px" }}
      ></div>

      <div className="mt-4 flex flex-col gap-2">
        {!isStarted ? (
          <button
            onClick={startScanner}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition active:scale-95"
          >
            Aktifkan Kamera
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition active:scale-95"
          >
            Matikan Kamera
          </button>
        )}
      </div>

      <style jsx global>{`
        #${containerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
}
