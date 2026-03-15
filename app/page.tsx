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

  // === STATE FITUR REQUEST BARANG ===
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqData, setReqData] = useState({ nama: "", barang: "", jumlah: "", keterangan: "" });
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

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
      // 2. Hitung sisa stok
      const sisaStokBaru = (qtyAwal - qtyAmbil).toString();

      // 3. Update stok
      const { error: errorUpdate } = await supabase
        .from("inventory")
        .update({ quantity: sisaStokBaru })
        .eq("id", itemData.id);

      if (errorUpdate) throw errorUpdate;

      // 4. Catat riwayat
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

  // === FUNGSI SUBMIT REQUEST ===
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqData.nama || !reqData.barang || !reqData.jumlah) {
      return alert("⚠️ Nama, Barang, dan Jumlah wajib diisi!");
    }

    setIsSubmittingReq(true);
    try {
      const { error } = await supabase.from("item_requests").insert([{
        nama_peminjam: reqData.nama,
        nama_barang: reqData.barang,
        jumlah: Number(reqData.jumlah),
        keterangan: reqData.keterangan || "-"
      }]);

      if (error) throw error;
      alert("✅ Request berhasil dikirim ke Admin!");
      setShowReqModal(false);
      setReqData({ nama: "", barang: "", jumlah: "", keterangan: "" });
    } catch (err) {
      alert("❌ Gagal mengirim request. Coba lagi.");
    } finally {
      setIsSubmittingReq(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-12">
      {/* HEADER */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-20 border-b border-slate-700">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
              <span className="text-xl">📦</span>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">GMF Inventory</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">Self-Service Peminjaman</p>
            </div>
          </div>
          <a 
            href="/so" 
            className="group flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 shadow-sm border border-slate-700"
          >
            <span>Admin</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-12">
        <div className="w-full max-w-md mx-auto">
          
          {/* TAMPILAN STANDBY */}
          {!isScanning && !isLoading && !itemData && !errorMsg && (
            <div className="bg-white p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 text-center group animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-300">
                <span className="text-5xl">📷</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Ambil Barang</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-10">Scan QR Code yang tertempel pada fisik barang untuk memulai proses peminjaman.</p>
              
              <button
                onClick={() => setIsScanning(true)}
                className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-5 px-6 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex justify-center items-center gap-3 text-lg"
              >
                MULAI SCAN BARANG
              </button>

              {/* TOMBOL REQUEST BARANG */}
              <div className="pt-8 mt-8 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Barang tidak ada?</p>
                <button
                  onClick={() => setShowReqModal(true)}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-4 px-6 rounded-2xl border border-slate-200 transition-all active:scale-95 flex justify-center items-center gap-2 text-sm"
                >
                  📝 AJUKAN REQUEST
                </button>
              </div>
            </div>
          )}

          {/* TAMPILAN SCANNING */}
          {isScanning && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 text-center animate-in zoom-in-95 duration-300">
              <QRScanner onScanSuccess={handleScanSuccess} />
              <div className="mt-8">
                <button
                  onClick={() => setIsScanning(false)}
                  className="w-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold py-4 rounded-xl transition-all"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* TAMPILAN LOADING */}
          {isLoading && (
            <div className="bg-white p-24 rounded-[2.5rem] shadow-xl border border-slate-200 text-center animate-in fade-in duration-300">
              <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6"></div>
              <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Mencari data...</p>
            </div>
          )}

          {/* TAMPILAN ERROR */}
          {errorMsg && !isLoading && (
            <div className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-red-100 text-center animate-in shake duration-500">
              <div className="text-6xl mb-6">⚠️</div>
              <h3 className="text-xl font-black text-red-600 mb-3">Gagal Membaca</h3>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed">{errorMsg}</p>
              <div className="space-y-3">
                <button
                  onClick={() => { setErrorMsg(null); setIsScanning(true); }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all"
                >
                  Coba Scan Lagi
                </button>
                <button 
                  onClick={resetTampilan} 
                  className="w-full text-slate-400 hover:text-slate-600 font-bold py-2 text-sm transition-all"
                >
                  Kembali
                </button>
              </div>
            </div>
          )}

          {/* TAMPILAN DETAIL BARANG */}
          {itemData && !isLoading && (
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-300 overflow-hidden animate-in slide-in-from-top-4 duration-500">
              <div className="bg-slate-900 p-8 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">Detail Inventory</span>
                <h2 className="text-3xl font-black tracking-tight">{itemData.part_name}</h2>
                
                <div className="mt-8 grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Part Number</p>
                    <p className="text-sm font-bold text-slate-200">{itemData.part_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Lokasi</p>
                    <p className="text-sm font-bold text-slate-200">{itemData.location || "N/A"}</p>
                  </div>
                  <div className="col-span-2 pt-4 border-t border-slate-600 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Stok Tersedia</p>
                      <p className="text-4xl font-black text-green-400 leading-none">
                        {itemData.quantity} <span className="text-sm font-medium text-slate-500 uppercase tracking-normal">unit</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8 bg-slate-50/50">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Nama Peminjam</label>
                  <input 
                    type="text" 
                    value={namaPeminjam}
                    onChange={(e) => setNamaPeminjam(e.target.value)}
                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-5 text-sm font-bold text-slate-900 transition-all outline-none shadow-sm" 
                    placeholder="Ketik nama lengkap..." 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Jumlah Pengambilan</label>
                  <input 
                    type="number" 
                    min="1" 
                    max={itemData.quantity} 
                    value={jumlahDiambil}
                    onChange={(e) => setJumlahDiambil(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-5 text-2xl font-black text-slate-900 transition-all outline-none shadow-sm" 
                    placeholder="0" 
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={resetTampilan} 
                    disabled={isSubmitting}
                    className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-5 rounded-2xl font-bold transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleProsesAmbil}
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    ) : (
                      "AMBIL SEKARANG"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ==========================================
          MODAL: REQUEST BARANG (POPUP)
          ========================================== */}
      {showReqModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="font-black text-xl text-slate-900 tracking-tight">Request Barang</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Pengajuan Stok Baru</p>
              </div>
              <button 
                onClick={() => setShowReqModal(false)} 
                className="w-10 h-10 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full flex items-center justify-center font-bold transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto">
              <form onSubmit={handleSubmitRequest} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Nama Pemohon *</label>
                  <input 
                    type="text" 
                    required 
                    value={reqData.nama} 
                    onChange={(e) => setReqData({...reqData, nama: e.target.value})} 
                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none" 
                    placeholder="Nama lengkap..." 
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Nama Barang *</label>
                  <input 
                    type="text" 
                    required 
                    value={reqData.barang} 
                    onChange={(e) => setReqData({...reqData, barang: e.target.value})} 
                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none" 
                    placeholder="Misal: Santovac 5" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Jumlah *</label>
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    value={reqData.jumlah} 
                    onChange={(e) => setReqData({...reqData, jumlah: e.target.value})} 
                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none" 
                    placeholder="Contoh: 2" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Workshop / Unit</label>
                  <textarea 
                    rows={2} 
                    value={reqData.keterangan} 
                    onChange={(e) => setReqData({...reqData, keterangan: e.target.value})} 
                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none resize-none" 
                    placeholder="Keterangan barang kebutuhan" 
                  />
                </div>

                <div className="flex gap-4 pt-2 border-t border-slate-100 mt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowReqModal(false)} 
                    className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-4 rounded-2xl font-bold transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingReq} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center"
                  >
                    {isSubmittingReq ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "KIRIM REQUEST"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}