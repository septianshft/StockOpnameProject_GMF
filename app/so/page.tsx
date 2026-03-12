"use client";

import { useState } from "react";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase";

export default function StockOpnamePage() {
  // State Keamanan (PIN)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const PIN_RAHASIA = "123456"; // Bisa diganti sesuai selera nanti

  // State Aplikasi
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [itemData, setItemData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State Form SO
  const [stokFisik, setStokFisik] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fungsi Login PIN
  const handleLoginAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === PIN_RAHASIA) {
      setIsAuthenticated(true);
    } else {
      alert("❌ PIN Salah!");
      setPinInput("");
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    setIsScanning(false);
    setIsLoading(true);
    setErrorMsg(null);
    setItemData(null);
    setStokFisik("");

    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("barcode_id", decodedText)
        .maybeSingle(); 

      if (error) {
        setErrorMsg("Terjadi kesalahan saat membaca database.");
      } else if (!data) {
        setErrorMsg("Barang tidak ditemukan di database.");
      } else {
        setItemData(data);
      }
    } catch (err) {
      setErrorMsg("Terjadi kesalahan sistem saat menghubungi database.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStok = async () => {
    if (stokFisik === "" || stokFisik < 0) {
      alert("⚠️ Masukkan jumlah stok fisik yang valid (minimal 0)!");
      return;
    }

    setIsSubmitting(true);
    const qtySistem = Number(itemData.quantity);
    const qtyFisikReal = Number(stokFisik);
    const selisih = qtyFisikReal - qtySistem; // Hitung selisih untuk dicatat di riwayat

    try {
      // 1. Update stok di tabel inventory menjadi angka fisik yang baru
      const { error: errorUpdate } = await supabase
        .from("inventory")
        .update({ quantity: qtyFisikReal.toString() })
        .eq("id", itemData.id);

      if (errorUpdate) throw errorUpdate;

      // 2. Catat ke riwayat transaksi bahwa ada penyesuaian (SO)
      if (selisih !== 0) {
        await supabase.from("transactions").insert([
          {
            inventory_id: itemData.id,
            part_name: itemData.part_name,
            part_number: itemData.part_number,
            nama_peminjam: "ADMIN (SO)", // Penanda kalau ini adalah proses SO
            jumlah: selisih // Bisa plus, bisa minus tergantung selisihnya
          }
        ]);
      }

      alert(`✅ STOCK OPNAME BERHASIL!\n\nStok ${itemData.part_name} telah diperbarui dari ${qtySistem} menjadi ${qtyFisikReal}.`);
      resetTampilan();
      
    } catch (err) {
      console.error("Gagal update SO:", err);
      alert("❌ Terjadi kesalahan saat menyimpan data Stock Opname.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetTampilan = () => {
    setItemData(null);
    setErrorMsg(null);
    setIsScanning(false);
    setStokFisik("");
  };

  // TAMPILAN 1: GERBANG PIN ADMIN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🔒
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Akses Admin</h1>
          <p className="text-gray-500 text-sm mb-6">Masukkan PIN untuk mode Stock Opname</p>
          
          <form onSubmit={handleLoginAdmin}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="* * * * * *"
              className="w-full text-center tracking-widest text-2xl border-2 border-gray-300 rounded-lg p-3 mb-4 focus:border-slate-800 focus:ring-0 outline-none"
              maxLength={6}
              autoFocus
            />
            <button 
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg transition active:scale-95"
            >
              Masuk Mode SO
            </button>
          </form>
          <a href="/" className="block mt-6 text-sm text-slate-500 hover:text-slate-800 underline">
            Kembali ke Peminjaman Karyawan
          </a>
        </div>
      </div>
    );
  }

  // TAMPILAN 2: HALAMAN UTAMA STOCK OPNAME
  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-black flex flex-col items-center pt-8">
      {/* Header Khusus Admin (Warna Gelap) */}
      <div className="w-full max-w-md bg-slate-800 rounded-xl shadow-md p-6 text-center mb-6 text-white relative">
        <button 
          onClick={() => setIsAuthenticated(false)}
          className="absolute top-4 right-4 text-xs bg-slate-700 px-2 py-1 rounded hover:bg-red-600 transition"
        >
          Keluar
        </button>
        <h1 className="text-2xl font-bold">Mode Stock Opname</h1>
        <p className="text-sm text-slate-300 mt-1">Sistem Penyesuaian Fisik</p>
      </div>

      <div className="w-full max-w-md">
        {!isScanning && !isLoading && !itemData && !errorMsg && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <button
              onClick={() => setIsScanning(true)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-6 rounded-lg shadow-lg transform transition active:scale-95 text-lg flex justify-center items-center gap-2"
            >
              <span className="text-2xl">📷</span> SCAN UNTUK AUDIT
            </button>
          </div>
        )}

        {isScanning && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
            <p className="font-semibold text-slate-600 mb-4">Arahkan kamera ke QR Code Barang</p>
            <QRScanner onScanSuccess={handleScanSuccess} />
            <button
              onClick={() => setIsScanning(false)}
              className="mt-6 w-full bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 px-4 rounded-lg"
            >
              Batal Scan
            </button>
          </div>
        )}

        {isLoading && (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-800 mb-4"></div>
            <p className="text-slate-600 font-medium">Mencari data barang...</p>
          </div>
        )}

        {errorMsg && !isLoading && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200 text-center">
            <div className="text-red-500 text-4xl mb-2">⚠️</div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Audit Gagal</h2>
            <p className="text-slate-600 mb-6">{errorMsg}</p>
            <button
              onClick={() => { setErrorMsg(null); setIsScanning(true); }}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg"
            >
              Coba Scan Lagi
            </button>
            <button onClick={resetTampilan} className="mt-3 w-full text-slate-500 font-semibold py-2">
              Batal
            </button>
          </div>
        )}

        {itemData && !isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-800 p-5 border-b border-slate-700 text-white">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data Sistem</span>
              <h2 className="text-xl font-bold mt-1">{itemData.part_name}</h2>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Lokasi</p>
                  <p className="font-semibold">{itemData.location}</p>
                </div>
                <div>
                  <p className="text-slate-400">Tercatat di Sistem</p>
                  <p className="font-bold text-amber-400 text-lg">
                    {itemData.quantity} <span className="text-sm font-normal">unit</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 bg-amber-50">
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-800 mb-2">Berapa jumlah fisik aktual di rak/gudang?</label>
                <input 
                  type="number" 
                  min="0" 
                  value={stokFisik}
                  onChange={(e) => setStokFisik(e.target.value ? Number(e.target.value) : "")}
                  className="w-full border-2 border-amber-300 rounded-md p-4 text-xl font-bold text-center focus:ring-amber-500 focus:border-amber-500" 
                  placeholder="Ketik angka fisik real..." 
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={resetTampilan} 
                  disabled={isSubmitting}
                  className="flex-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold py-3 px-4 rounded-lg disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={handleUpdateStok}
                  disabled={isSubmitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transform transition active:scale-95 disabled:opacity-50 flex justify-center items-center"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    "Sesuaikan Stok"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}