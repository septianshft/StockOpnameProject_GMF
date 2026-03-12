"use client";

import { useState } from "react";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [itemData, setItemData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State untuk form peminjaman
  const [namaPeminjam, setNamaPeminjam] = useState("");
  const [jumlahDiambil, setJumlahDiambil] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleScanSuccess = async (decodedText: string) => {
    setIsScanning(false);
    setIsLoading(true);
    setErrorMsg(null);
    setItemData(null);
    setNamaPeminjam("");
    setJumlahDiambil("");

    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("barcode_id", decodedText)
        .maybeSingle(); 

      if (error) {
        console.error("Error Detail:", error.message, error.details);
        setErrorMsg("Terjadi kesalahan saat membaca database.");
      } else if (!data) {
        setErrorMsg("Barang tidak ditemukan di database.");
      } else {
        setItemData(data);
      }
    } catch (err) {
      console.error("System error:", err);
      setErrorMsg("Terjadi kesalahan sistem saat menghubungi database.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProsesAmbil = async () => {
    // 1. Validasi Input
    if (!namaPeminjam.trim()) {
      alert("⚠️ Nama Peminjam tidak boleh kosong!");
      return;
    }
    const qtyAwal = Number(itemData.quantity);
    const qtyAmbil = Number(jumlahDiambil);

    if (qtyAmbil <= 0 || qtyAmbil > qtyAwal) {
      alert(`⚠️ Jumlah tidak valid! Masukkan angka antara 1 sampai ${qtyAwal}`);
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. Hitung sisa stok (jadikan string karena DB kamu butuh text)
      const sisaStokBaru = (qtyAwal - qtyAmbil).toString();

      // 3. TUGAS PERTAMA: Update stok di tabel inventory
      const { error: errorUpdate } = await supabase
        .from("inventory")
        .update({ quantity: sisaStokBaru })
        .eq("id", itemData.id);

      if (errorUpdate) throw errorUpdate;

      // 4. TUGAS KEDUA: Catat riwayat ke tabel transactions
      const { error: errorInsert } = await supabase
        .from("transactions")
        .insert([
          {
            inventory_id: itemData.id,
            part_name: itemData.part_name,
            part_number: itemData.part_number,
            nama_peminjam: namaPeminjam,
            jumlah: qtyAmbil
          }
        ]);

      if (errorInsert) {
        console.error("Gagal mencatat riwayat:", errorInsert);
        alert("⚠️ Stok berhasil dipotong, tapi gagal mencatat ke riwayat transaksi.");
      } else {
        // Sukses Total!
        alert(`✅ BERHASIL!\n\n${qtyAmbil} unit ${itemData.part_name} telah diambil oleh ${namaPeminjam}.\nSisa stok di sistem sekarang: ${sisaStokBaru}`);
      }
      
      resetTampilan();
      
    } catch (err) {
      console.error("Gagal update database:", err);
      alert("❌ Terjadi kesalahan saat memotong stok di database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetTampilan = () => {
    setItemData(null);
    setErrorMsg(null);
    setIsScanning(false);
    setNamaPeminjam("");
    setJumlahDiambil("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans text-black flex flex-col items-center pt-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6 text-center mb-6 border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">Sistem Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Scan Barang & Peminjaman</p>
      </div>

      <div className="w-full max-w-md">
        {!isScanning && !isLoading && !itemData && !errorMsg && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
            <button
              onClick={() => setIsScanning(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transform transition active:scale-95 text-lg flex justify-center items-center gap-2"
            >
              <span className="text-2xl">📷</span> MULAI SCAN BARANG
            </button>
          </div>
        )}

        {isScanning && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
            <p className="font-semibold text-gray-600 mb-4">Arahkan kamera ke QR Code Barang</p>
            <QRScanner onScanSuccess={handleScanSuccess} />
            <div className="mt-4">
              <button
                onClick={() => setIsScanning(false)}
                className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 px-4 rounded-lg"
              >
                Batal Scan
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Mencari data di database...</p>
          </div>
        )}

        {errorMsg && !isLoading && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200 text-center">
            <div className="text-red-500 text-4xl mb-2">⚠️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Gagal Membaca Barang</h2>
            <p className="text-gray-600 mb-6">{errorMsg}</p>
            <button
              onClick={() => { setErrorMsg(null); setIsScanning(true); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
            >
              Coba Scan Lagi
            </button>
            <button onClick={resetTampilan} className="mt-3 w-full text-gray-500 font-semibold py-2 hover:bg-gray-100 rounded-lg">
              Kembali
            </button>
          </div>
        )}

        {itemData && !isLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-blue-50 p-5 border-b border-blue-100">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Detail Barang</span>
              <h2 className="text-xl font-bold text-gray-800 mt-1">{itemData.part_name}</h2>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Part Number</p>
                  <p className="font-semibold text-gray-800">{itemData.part_number}</p>
                </div>
                <div>
                  <p className="text-gray-500">Lokasi</p>
                  <p className="font-semibold text-gray-800">{itemData.location}</p>
                </div>
                <div>
                  <p className="text-gray-500">Batch Number</p>
                  <p className="font-semibold text-gray-800">{itemData.batch_number || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Stok Tersedia</p>
                  <p className="font-bold text-green-600 text-lg">
                    {itemData.quantity} <span className="text-sm font-normal text-gray-600">unit</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Peminjam / Pengambil</label>
                <input 
                  type="text" 
                  value={namaPeminjam}
                  onChange={(e) => setNamaPeminjam(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Masukkan nama..." 
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Diambil</label>
                <input 
                  type="number" 
                  min="1" 
                  max={itemData.quantity} 
                  value={jumlahDiambil}
                  onChange={(e) => setJumlahDiambil(e.target.value ? Number(e.target.value) : "")}
                  className="w-full border border-gray-300 rounded-md p-3 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Contoh: 1" 
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={resetTampilan} 
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={handleProsesAmbil}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transform transition active:scale-95 disabled:opacity-50 flex justify-center items-center"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    "Proses Ambil"
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