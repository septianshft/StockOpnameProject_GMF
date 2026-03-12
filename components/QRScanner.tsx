"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export default function QRScanner({ onScanSuccess }: QRScannerProps) {
  // Gunakan ref untuk melacak apakah scanner sedang berjalan
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Pastikan elemen #reader ada di DOM sebelum inisialisasi
    if (document.getElementById("reader")) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        false
      );

      scannerRef.current.render(
        (text) => {
          // Kalau berhasil, hentikan kamera dengan aman
          if (scannerRef.current) {
             scannerRef.current.clear().then(() => {
                 onScanSuccess(text);
             }).catch(console.error);
          }
        },
        (error) => {
          // Abaikan log error agar console tidak penuh
        }
      );
    }

    // Cleanup saat komponen dibongkar (unmount)
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [onScanSuccess]);

  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-lg overflow-hidden relative shadow-md p-2">
      <style>{`
        #reader {
          width: 100% !important;
          border: none !important;
        }
        #reader video {
          width: 100% !important;
          height: auto !important;
          object-fit: cover !important;
          border-radius: 0.5rem; /* Tambah rounded corners biar rapi */
        }
        
        /* -- PERBAIKAN CSS: JANGAN SEMBUNYIKAN TAG <a> -- */
        
        /* Sembunyikan tulisan 'Powered by html5-qrcode' spesifik (biasanya ada di akhir) */
        #reader > a {
           display: none !important;
        }
        
        /* Rapikan tombol bawaan library */
        #reader button {
           background-color: #3b82f6 !important; /* warna biru */
           color: white !important;
           border: none !important;
           padding: 0.5rem 1rem !important;
           border-radius: 0.375rem !important;
           cursor: pointer !important;
           margin-top: 0.5rem !important;
           margin-bottom: 0.5rem !important;
        }
        #reader button:hover {
           background-color: #2563eb !important;
        }
        
        /* Rapikan input file */
        #reader input[type="file"] {
           margin-bottom: 0.5rem !important;
        }
      `}</style>
      
      <div id="reader"></div>
    </div>
  );
}