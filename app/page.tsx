"use client";

import { useState } from "react";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase";

// Tipe data untuk item di dalam keranjang
type CartItem = {
  id: number;
  part_name: string;
  part_number: string;
  location: string;
  max_quantity: number;
  quantity_to_take: number;
  barcode_id: string;
};

export default function Home() {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // === STATE BARU: SISTEM KERANJANG (CART) ===
  const [cart, setCart] = useState<CartItem[]>([]);
  const [namaPeminjam, setNamaPeminjam] = useState("");
  const [nomorPegawai, setNomorPegawai] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // === STATE FITUR REQUEST BARANG ===
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqData, setReqData] = useState({ nama: "", barang: "", jumlah: "", keterangan: "" });
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // === STATE BARU: FITUR PENCARIAN LOKASI ===
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inventoryDb, setInventoryDb] = useState<any[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  // Fungsi membuka modal pencarian dan menarik data terbaru
  const openSearchModal = async () => {
    setShowSearchModal(true);
    setIsSearchingDb(true);
    setSearchQuery(""); // Reset pencarian
    try {
      const { data, error } = await supabase.from("inventory").select("*").order("part_name", { ascending: true });
      if (error) throw error;
      if (data) setInventoryDb(data);
    } catch (err) {
      console.error("Gagal menarik data untuk pencarian", err);
    } finally {
      setIsSearchingDb(false);
    }
  };

  // Filter data berdasarkan inputan pencarian
  const filteredItems = inventoryDb.filter(item =>
    item.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.part_number && item.part_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleScanSuccess = async (decodedText: string) => {
    setIsScanning(false);
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("barcode_id", decodedText)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMsg("Item not found in database.");
        return;
      }

      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === data.id);

        if (existingItem) {
          if (existingItem.quantity_to_take < existingItem.max_quantity) {
            return prevCart.map((item) =>
              item.id === data.id
                ? { ...item, quantity_to_take: item.quantity_to_take + 1 }
                : item
            );
          } else {
            alert(`⚠️ Stok maksimal ${data.part_name} di sistem hanya ${existingItem.max_quantity} unit!`);
            return prevCart;
          }
        } else {
          return [...prevCart, {
            id: data.id,
            part_name: data.part_name,
            part_number: data.part_number,
            location: data.location,
            max_quantity: Number(data.quantity),
            quantity_to_take: 1,
            barcode_id: data.barcode_id
          }];
        }
      });

    } catch (err) {
      console.error("System error:", err);
      setErrorMsg("Terjadi kesalahan sistem saat menghubungi database.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === id) {
        const newQty = item.quantity_to_take + delta;
        if (newQty > 0 && newQty <= item.max_quantity) {
          return { ...item, quantity_to_take: newQty };
        }
      }
      return item;
    }));
  };

  const removeFromCart = (id: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const handleProsesAmbil = async () => {
    if (!namaPeminjam.trim() || !nomorPegawai.trim()) return alert("⚠️ Nama dan Nomor Pegawai wajib diisi!");
    if (cart.length === 0) return alert("⚠️ Keranjang masih kosong!");

    setIsSubmitting(true);

    try {
      for (const item of cart) {
        const sisaStokBaru = (item.max_quantity - item.quantity_to_take).toString();
        const { error: errorUpdate } = await supabase
          .from("inventory")
          .update({ quantity: sisaStokBaru })
          .eq("id", item.id);

        if (errorUpdate) throw errorUpdate;

        const { error: errorInsert } = await supabase
          .from("transactions")
          .insert([{
            inventory_id: item.id,
            part_name: item.part_name,
            part_number: item.part_number,
            nama_peminjam: namaPeminjam,
            nomor_pegawai: nomorPegawai,
            jumlah: -item.quantity_to_take
          }]);

        if (errorInsert) throw errorInsert;
      }

      alert(`✅ BERHASIL!\n\n${cart.length} jenis barang telah diproses.`);
      setCart([]);
      setNamaPeminjam("");
      setNomorPegawai("");

    } catch (err) {
      console.error("Gagal update database:", err);
      alert("❌ Terjadi kesalahan saat memotong stok di database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqData.nama || !reqData.barang || !reqData.jumlah) return alert("⚠️ Nama, Barang, dan Jumlah wajib diisi!");

    setIsSubmittingReq(true);
    try {
      const { error } = await supabase.from("item_requests").insert([{
        nama_peminjam: reqData.nama,
        nama_barang: reqData.barang,
        jumlah: Number(reqData.jumlah),
        keterangan: reqData.keterangan || "-"
      }]);
      if (error) throw error;

      alert("✅ Request berhasil dicatat sistem!");
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
      {/* HEADER (STAYS NOTION STYLE) */}
      <header className="bg-[#1e1e1e] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.06)] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] rounded-[4px] flex items-center justify-center">
              <span className="text-xl">📦</span>
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight leading-none text-white">GMF Inventory</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-black mt-1">Self-Service Item Request</p>
            </div>
          </div>
          <a href="/so" className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-[4px] text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] text-white">
            <span>Admin</span><span className="group-hover:translate-x-1 transition-transform opacity-40">→</span>
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-12">
        <div className="w-full max-w-md mx-auto">

          {/* TAMPILAN AWAL (STANDBY & KERANJANG KOSONG) */}
          {!isScanning && !isLoading && cart.length === 0 && !errorMsg && (
            <div className="bg-white p-12 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200 text-center group animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-300">
                <img src="https://img.icons8.com/?size=100&id=u6A1fcsd1q2J&format=png&color=000000" alt="Camera" className="w-16 h-16" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Scan Item</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-10">Scan QR code item to add it to your cart.</p>

              <button
                onClick={() => setIsScanning(true)}
                className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-5 px-6 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 flex justify-center items-center gap-3 text-lg"
              >
                START SCANNING
              </button>

              <div className="grid grid-cols-2 gap-4 pt-8 mt-8 border-t border-slate-100">
                <div className="flex flex-col">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Where's the item?</p>
                  <button onClick={openSearchModal} className="w-full flex-1 bg-white hover:bg-blue-50 text-blue-600 font-bold py-4 px-2 rounded-2xl border-2 border-blue-100 transition-all active:scale-95 text-xs flex justify-center items-center gap-2">
                    <span className="text-lg leading-none">🔍</span> Check Location
                  </button>
                </div>
                <div className="flex flex-col">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Out of Stock?</p>
                  <button onClick={() => setShowReqModal(true)} className="w-full flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-4 px-2 rounded-2xl border-2 border-slate-200 transition-all active:scale-95 text-xs flex justify-center items-center gap-2">
                    <img src="https://img.icons8.com/?size=100&id=MkbXzLXnS7Wn&format=png&color=000000" alt="Request Item" className="w-5 h-5 opacity-60" /> Request
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAMPILAN SCANNING */}
          {isScanning && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 text-center animate-in zoom-in-95 duration-300">
              <div className="mb-6">
                <h3 className="font-black text-slate-900 text-lg">Scanning Active</h3>
                <p className="text-sm text-slate-500">Point camera at QR Code item</p>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-inner border border-slate-100">
                <QRScanner onScanSuccess={handleScanSuccess} />
              </div>
              <div className="mt-8">
                <button
                  onClick={() => setIsScanning(false)}
                  className="w-full bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-bold py-4 rounded-xl transition-all"
                >
                  {cart.length > 0 ? "Finish Scanning" : "Cancel Scanning"}
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
              <h3 className="text-xl font-black text-red-600 mb-3">Failed to Read QR Code</h3>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed">{errorMsg}</p>
              <div className="space-y-3">
                <button onClick={() => { setErrorMsg(null); setIsScanning(true); }} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all">
                  Retry Scanning
                </button>
                <button onClick={() => setErrorMsg(null)} className="w-full text-slate-400 hover:text-slate-600 font-bold py-2 text-sm transition-all">
                  Cancel Scanning
                </button>
              </div>
            </div>
          )}

          {/* TAMPILAN KERANJANG (CART) */}
          {cart.length > 0 && !isScanning && !isLoading && !errorMsg && (
            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-300 overflow-hidden animate-in slide-in-from-top-4 duration-500">
              <div className="bg-slate-900 p-8 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                  🛒 Item Request Cart
                </span>
                <h2 className="text-3xl font-black tracking-tight">{cart.length} Item</h2>
                <p className="text-slate-400 text-sm mt-2">Ready to process.</p>
              </div>

              <div className="p-6 md:p-8 bg-slate-50/50">
                <div className="space-y-4 mb-8">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{item.part_name}</h3>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">Available Stock: <span className="font-bold text-slate-700">{item.max_quantity}</span></p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-black transition-colors">-</button>
                          <span className="w-6 text-center font-black text-slate-800 text-sm">{item.quantity_to_take}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-black transition-colors">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setIsScanning(true)}
                  className="w-full bg-white border-2 border-dashed border-blue-200 hover:border-blue-400 text-blue-600 font-bold py-4 rounded-2xl mb-8 flex items-center justify-center gap-2 transition-all hover:bg-blue-50"
                >
                  <span className="text-xl">📷</span> Add More Items
                </button>

                <div className="pt-6 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Employee ID *</label>
                      <input
                        type="text"
                        value={nomorPegawai}
                        onChange={(e) => setNomorPegawai(e.target.value)}
                        className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none transition-all shadow-sm"
                        placeholder="Employee ID"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Name *</label>
                      <input
                        type="text"
                        value={namaPeminjam}
                        onChange={(e) => setNamaPeminjam(e.target.value)}
                        className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 outline-none transition-all shadow-sm"
                        placeholder="Nama..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setCart([])} disabled={isSubmitting} className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-5 rounded-2xl font-bold transition-all">
                      Reset Cart
                    </button>
                    <button onClick={handleProsesAmbil} disabled={isSubmitting} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center text-sm">
                      {isSubmitting ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : "SUBMIT ALL"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL PENCARIAN LOKASI BARANG */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-300 border border-white/20">

            {/* Header Modal Search */}
            <div className="p-6 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-black text-xl tracking-tight">Katalog Barang</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Cari Posisi Rak & Stok</p>
              </div>
              <button onClick={() => setShowSearchModal(false)} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors text-xl font-light">
                ✕
              </button>
            </div>

            {/* Input Pencarian */}
            <div className="p-6 bg-slate-50 shrink-0 shadow-sm z-10">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 text-lg">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-2 border-slate-200 focus:border-blue-500 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-900 transition-all outline-none shadow-sm"
                  placeholder="Ketik nama part atau part number..."
                  autoFocus
                />
              </div>
            </div>

            {/* Hasil Pencarian (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50">
              {isSearchingDb ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full mb-4"></div>
                  <p className="text-xs font-bold uppercase tracking-widest">Memuat Katalog...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.length > 0 ? (
                    filteredItems.map(item => (
                      <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div className="pr-4">
                            <h3 className="font-black text-slate-800 leading-tight">{item.part_name}</h3>
                            <p className="text-[10px] font-mono text-slate-400 mt-1">{item.part_number || "No PN"}</p>
                          </div>
                          <div className={`shrink-0 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${item.quantity > 0 ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"
                            }`}>
                            {item.quantity > 0 ? `${item.quantity} Tersedia` : "Kosong"}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl flex items-center gap-3 border border-slate-100">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">📍</div>
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lokasi Laci / Rak</p>
                            <p className="text-sm font-bold text-slate-800">{item.location || "Belum Ditentukan"}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-4 opacity-50">🤷‍♂️</div>
                      <p className="text-slate-500 font-bold text-sm">Barang tidak ditemukan.</p>
                      <p className="text-xs text-slate-400 mt-1">Coba kata kunci lain atau ajukan request.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL: REQUEST BARANG */}
      {showReqModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 text-slate-900">
              <div>
                <h2 className="font-black text-xl tracking-tight">Request Item</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Request new item stock</p>
              </div>
              <button onClick={() => setShowReqModal(false)} className="w-10 h-10 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full flex items-center justify-center font-bold transition-colors">✕</button>
            </div>
            <div className="p-8 overflow-y-auto">
              <form onSubmit={handleSubmitRequest} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Requester Name *</label>
                  <input type="text" required value={reqData.nama} onChange={(e) => setReqData({ ...reqData, nama: e.target.value })} className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none" placeholder="Fullname...." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Item Name *</label>
                  <input type="text" required value={reqData.barang} onChange={(e) => setReqData({ ...reqData, barang: e.target.value })} className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none" placeholder="Example: Santovac 5" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Quantity *</label>
                  <input type="number" required min="1" value={reqData.jumlah} onChange={(e) => setReqData({ ...reqData, jumlah: e.target.value })} className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none" placeholder="Example: 12" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Request Description *</label>
                  <textarea rows={2} value={reqData.keterangan} onChange={(e) => setReqData({ ...reqData, keterangan: e.target.value })} className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-2xl p-4 text-sm font-bold text-slate-900 transition-all outline-none resize-none" placeholder="Additional Details" />
                </div>
                <div className="flex gap-4 pt-2 border-t border-slate-100 mt-4">
                  <button type="button" onClick={() => setShowReqModal(false)} className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-4 rounded-2xl font-bold transition-all">Cancel</button>
                  <button type="submit" disabled={isSubmittingReq} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg disabled:opacity-50 flex justify-center items-center">{isSubmittingReq ? "Sending..." : "Send"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
