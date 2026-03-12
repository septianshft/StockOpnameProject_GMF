"use client";

import { useState, useEffect } from "react";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  // State Keamanan (PIN)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const PIN_RAHASIA = "123456";

  // State Navigasi Tab
  const [activeTab, setActiveTab] = useState("scanner");

  // State Tab 1: Scanner (SO)
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [itemData, setItemData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stokFisik, setStokFisik] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Tab 2 & 3: Data Master & History
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // State Modal (Tambah & Edit)
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    part_name: "",
    part_number: "",
    location: "",
    quantity: "",
    barcode_id: "",
  });

  // --- FUNGSI LOGIN ---
  const handleLoginAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === PIN_RAHASIA) {
      setIsAuthenticated(true);
    } else {
      alert("❌ PIN Salah!");
      setPinInput("");
    }
  };

  // --- FUNGSI AMBIL DATA TABEL ---
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === "inventory") fetchInventory();
      if (activeTab === "history") fetchHistory();
    }
  }, [activeTab, isAuthenticated]);

  const fetchInventory = async () => {
    setIsLoadingData(true);
    const { data, error } = await supabase.from("inventory").select("*").order("part_name", { ascending: true });
    if (!error && data) setInventoryList(data);
    setIsLoadingData(false);
  };

  const fetchHistory = async () => {
    setIsLoadingData(true);
    const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
    if (!error && data) setHistoryList(data);
    setIsLoadingData(false);
  };

  // --- FUNGSI SCANNER (SO) ---
  const handleScanSuccess = async (decodedText: string) => {
    setIsScanning(false);
    setIsLoadingScan(true);
    setErrorMsg(null);
    setItemData(null);
    setStokFisik("");

    try {
      const { data, error } = await supabase.from("inventory").select("*").eq("barcode_id", decodedText).maybeSingle(); 
      if (error) setErrorMsg("Terjadi kesalahan saat membaca database.");
      else if (!data) setErrorMsg("Barang tidak ditemukan di database.");
      else setItemData(data);
    } catch (err) {
      setErrorMsg("Terjadi kesalahan sistem.");
    } finally {
      setIsLoadingScan(false);
    }
  };

  const handleUpdateStok = async () => {
    if (stokFisik === "" || stokFisik < 0) return alert("⚠️ Masukkan jumlah stok valid!");
    setIsSubmitting(true);
    const qtySistem = Number(itemData.quantity);
    const qtyFisikReal = Number(stokFisik);
    const selisih = qtyFisikReal - qtySistem;

    try {
      const { error: errorUpdate } = await supabase.from("inventory").update({ quantity: qtyFisikReal.toString() }).eq("id", itemData.id);
      if (errorUpdate) throw errorUpdate;

      if (selisih !== 0) {
        await supabase.from("transactions").insert([{
          inventory_id: itemData.id,
          part_name: itemData.part_name,
          part_number: itemData.part_number,
          nama_peminjam: "ADMIN (SO)",
          jumlah: selisih
        }]);
      }
      alert(`✅ STOCK OPNAME BERHASIL!\nStok ${itemData.part_name} diperbarui menjadi ${qtyFisikReal}.`);
      resetScanTampilan();
    } catch (err) {
      alert("❌ Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetScanTampilan = () => {
    setItemData(null);
    setErrorMsg(null);
    setIsScanning(false);
    setStokFisik("");
  };

  // --- FUNGSI MASTER STOK (TAMBAH, EDIT, HAPUS, CETAK) ---
  const handleGenerateUUID = () => {
    setFormData({ ...formData, barcode_id: crypto.randomUUID() });
  };

  const openAddModal = () => {
    setEditId(null);
    setFormData({ part_name: "", part_number: "", location: "", quantity: "", barcode_id: "" });
    setShowAddModal(true);
  };

  const openEditModal = (item: any) => {
    setEditId(item.id);
    setFormData({
      part_name: item.part_name,
      part_number: item.part_number || "",
      location: item.location || "",
      quantity: item.quantity,
      barcode_id: item.barcode_id,
    });
    setShowAddModal(true);
  };

  const handleSimpanBarang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.part_name || !formData.barcode_id || !formData.quantity) {
      return alert("⚠️ Nama Barang, Barcode ID, dan Stok wajib diisi!");
    }

    setIsSavingItem(true);
    try {
      if (editId) {
        const { error } = await supabase.from("inventory").update({
          part_name: formData.part_name,
          part_number: formData.part_number,
          location: formData.location,
          quantity: formData.quantity.toString(),
          barcode_id: formData.barcode_id
        }).eq("id", editId);
        if (error) throw error;
        alert("✅ Data barang berhasil diubah!");
      } else {
        const { error } = await supabase.from("inventory").insert([{
          part_name: formData.part_name,
          part_number: formData.part_number,
          location: formData.location,
          quantity: formData.quantity.toString(),
          barcode_id: formData.barcode_id
        }]);
        if (error) throw error;
        alert("✅ Barang baru berhasil ditambahkan!");
      }
      setShowAddModal(false);
      fetchInventory();
    } catch (err: any) {
      if (err.code === '23505') alert("❌ Barcode ID sudah terdaftar di barang lain!");
      else alert("❌ Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleHapusBarang = async (id: number, namaBarang: string) => {
    const isConfirm = window.confirm(`⚠️ YAKIN INGIN MENGHAPUS "${namaBarang}"?\n\nSemua data barang ini akan hilang dari sistem.`);
    if (!isConfirm) return;

    try {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (error) throw error;
      alert(`🗑️ Barang "${namaBarang}" berhasil dihapus.`);
      fetchInventory(); 
    } catch (err: any) {
      if (err.code === '23503') {
        alert(`❌ GAGAL MENGHAPUS!\n\nBarang "${namaBarang}" memiliki riwayat transaksi/peminjaman.\n\nSistem mengunci penghapusan agar riwayat tidak rusak.`);
      } else {
        alert("❌ Terjadi kesalahan saat menghapus barang.");
      }
    }
  };

  // ==========================================
  // FITUR BARU: CETAK 1 QR
  // ==========================================
  const handleCetakQR = (item: any) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(item.barcode_id)}`;
    const printWindow = window.open('', '_blank', 'width=500,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak QR - ${item.part_name}</title>
            <style>
              body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f1f5f9; }
              .label-box { background: white; border: 2px solid #000; padding: 20px; text-align: center; width: 260px; border-radius: 8px; }
              h2 { margin: 0 0 5px 0; font-size: 20px; text-transform: uppercase; }
              p { margin: 0 0 15px 0; font-size: 14px; color: #333; font-weight: bold; }
              img { width: 180px; height: 180px; margin: 0 auto; display: block; }
              .uuid { margin-top: 15px; font-family: monospace; font-size: 11px; color: #555; word-break: break-all; }
              @media print {
                body { background: white; height: auto; display: block; padding: 0; margin: 0; }
                .label-box { border: 1px solid #000; border-radius: 0; margin: 0; }
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="label-box">
              <h2>${item.part_name}</h2>
              <p>PN: ${item.part_number || "-"}</p>
              <img src="${qrUrl}" alt="QR Code" />
              <div class="uuid">${item.barcode_id}</div>
            </div>
            <button class="no-print" onclick="window.print()" style="margin-top: 30px; padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              🖨️ Cetak Stiker Sekarang
            </button>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // ==========================================
  // FITUR BARU: CETAK SEMUA QR (MASS PRINT)
  // ==========================================
  const handleCetakSemuaQR = () => {
    if (inventoryList.length === 0) return alert("Belum ada barang di database!");

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Bikin HTML Grid untuk seluruh barang
      let itemsHtml = inventoryList.map(item => `
        <div class="label-box">
          <h2>${item.part_name}</h2>
          <p>PN: ${item.part_number || "-"}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.barcode_id)}" alt="QR Code" />
          <div class="uuid">${item.barcode_id}</div>
        </div>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Semua QR Code</title>
            <style>
              body { font-family: sans-serif; padding: 20px; background-color: #f1f5f9; }
              /* Aturan Grid untuk nampilin berjejer */
              .grid-container { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); 
                gap: 15px; 
              }
              .label-box { 
                background: white; 
                border: 2px solid #000; 
                padding: 15px; 
                text-align: center; 
                border-radius: 8px; 
                page-break-inside: avoid; /* Biar stiker ga kepotong di halaman beda pas di print */
              }
              h2 { margin: 0 0 5px 0; font-size: 16px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              p { margin: 0 0 10px 0; font-size: 12px; color: #333; font-weight: bold; }
              img { width: 130px; height: 130px; margin: 0 auto; display: block; }
              .uuid { margin-top: 10px; font-family: monospace; font-size: 9px; color: #555; word-break: break-all; }
              
              /* Header area sebelum ngeprint */
              .header { text-align: center; margin-bottom: 20px; }
              .print-btn { padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(37,99,235,0.3); }
              
              @media print {
                body { background: white; padding: 0; margin: 0; }
                .header, .no-print { display: none !important; }
                .label-box { border: 1px dashed #999; border-radius: 0; margin: 0; } /* Garis putus-putus biar gampang digunting */
                .grid-container { gap: 5px; }
              }
            </style>
          </head>
          <body>
            <div class="header no-print">
              <h1>Total ${inventoryList.length} Stiker QR</h1>
              <p>Pastikan gambar QR Code sudah termuat semua sebelum klik tombol cetak di bawah.</p>
              <button class="print-btn" onclick="window.print()">🖨️ Cetak Semua Sekarang</button>
            </div>
            <div class="grid-container">
              ${itemsHtml}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // ==========================================
  // TAMPILAN 1: GERBANG PIN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6">Masukkan PIN untuk mengakses sistem</p>
          <form onSubmit={handleLoginAdmin}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="* * * * * *"
              className="w-full text-center tracking-widest text-2xl border-2 border-gray-300 rounded-lg p-3 mb-4 focus:border-slate-800 outline-none"
              maxLength={6}
              autoFocus
            />
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg">Masuk</button>
          </form>
          <a href="/" className="block mt-6 text-sm text-slate-500 hover:text-slate-800 underline">Kembali ke Peminjaman Karyawan</a>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN 2: DASHBOARD ADMIN
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-black pb-10">
      <div className="bg-slate-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Admin Inventory</h1>
            <p className="text-xs text-slate-300">Sistem Manajemen & SO</p>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="bg-slate-700 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition">
            Keluar
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <button onClick={() => setActiveTab("scanner")} className={`flex-1 py-3 text-sm font-semibold transition ${activeTab === "scanner" ? "bg-amber-100 text-amber-700 border-b-2 border-amber-500" : "text-slate-600 hover:bg-slate-50"}`}>
            🔍 Audit (SO)
          </button>
          <button onClick={() => setActiveTab("inventory")} className={`flex-1 py-3 text-sm font-semibold transition ${activeTab === "inventory" ? "bg-blue-100 text-blue-700 border-b-2 border-blue-500" : "text-slate-600 hover:bg-slate-50"}`}>
            📦 Master Stok
          </button>
          <button onClick={() => setActiveTab("history")} className={`flex-1 py-3 text-sm font-semibold transition ${activeTab === "history" ? "bg-green-100 text-green-700 border-b-2 border-green-500" : "text-slate-600 hover:bg-slate-50"}`}>
            📜 Riwayat
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* TAB 1: SCANNER SO */}
        {activeTab === "scanner" && (
          <div className="w-full max-w-md mx-auto">
            {!isScanning && !isLoadingScan && !itemData && !errorMsg && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
                <button onClick={() => setIsScanning(true)} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-6 rounded-lg shadow-md text-lg">
                  📷 SCAN UNTUK AUDIT
                </button>
              </div>
            )}
            {isScanning && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
                <QRScanner onScanSuccess={handleScanSuccess} />
                <button onClick={() => setIsScanning(false)} className="mt-4 w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 rounded-lg">Batal</button>
              </div>
            )}
            {isLoadingScan && <p className="text-center py-10">Mencari data...</p>}
            {errorMsg && !isLoadingScan && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-red-200 text-center text-red-600 font-bold">
                {errorMsg} <br/><button onClick={resetScanTampilan} className="mt-4 text-blue-600 underline text-sm">Kembali</button>
              </div>
            )}
            {itemData && !isLoadingScan && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 p-5 text-white">
                  <h2 className="text-xl font-bold">{itemData.part_name}</h2>
                  <p className="text-sm text-slate-300 mt-1">Sistem: <span className="text-amber-400 font-bold text-lg">{itemData.quantity}</span> unit</p>
                </div>
                <div className="p-5 bg-amber-50">
                  <label className="block text-sm font-bold text-slate-800 mb-2">Stok Fisik Aktual:</label>
                  <input type="number" value={stokFisik} onChange={(e) => setStokFisik(e.target.value ? Number(e.target.value) : "")} className="w-full border-2 border-amber-300 rounded-md p-3 text-lg font-bold text-center" placeholder="Ketik angka..." autoFocus />
                  <div className="flex gap-3 mt-4">
                    <button onClick={resetScanTampilan} className="flex-1 bg-white border border-slate-300 py-2 rounded-lg font-semibold">Batal</button>
                    <button onClick={handleUpdateStok} disabled={isSubmitting} className="flex-1 bg-amber-500 text-white py-2 rounded-lg font-bold">Sesuaikan</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MASTER STOK */}
        {activeTab === "inventory" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-800">Daftar Barang</h2>
              
              {/* TOMBOL CETAK SEMUA DITAMBAHKAN DI SINI 👇 */}
              <div className="flex gap-2">
                <button onClick={handleCetakSemuaQR} className="bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold py-2 px-3 rounded-lg shadow-sm">
                  🖨️ Cetak Semua
                </button>
                <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded-lg shadow-sm">
                  + Tambah Barang
                </button>
              </div>

            </div>
            <div className="overflow-x-auto">
              {isLoadingData ? (
                <p className="text-center py-10 text-slate-500">Memuat data...</p>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-4 font-semibold">Nama Barang</th>
                      <th className="p-4 font-semibold">Part Number</th>
                      <th className="p-4 font-semibold text-center">Stok</th>
                      <th className="p-4 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-800">{item.part_name}</td>
                        <td className="p-4 text-slate-500">{item.part_number}</td>
                        <td className="p-4 text-center">
                          <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full font-bold">{item.quantity}</span>
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => handleCetakQR(item)} className="text-blue-600 hover:underline mr-4 font-bold">🖨️ Cetak 1</button>
                          <button onClick={() => openEditModal(item)} className="text-amber-500 hover:underline mr-4 font-semibold">Edit</button>
                          <button onClick={() => handleHapusBarang(item.id, item.part_name)} className="text-red-500 hover:underline font-semibold">Hapus</button>
                        </td>
                      </tr>
                    ))}
                    {inventoryList.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada barang di database.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RIWAYAT TRANSAKSI */}
        {activeTab === "history" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b bg-slate-50">
              <h2 className="font-bold text-slate-800">Log Aktivitas Terbaru</h2>
            </div>
            <div className="overflow-x-auto">
              {isLoadingData ? (
                <p className="text-center py-10 text-slate-500">Memuat data...</p>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-4 font-semibold">Waktu</th>
                      <th className="p-4 font-semibold">Peminjam / User</th>
                      <th className="p-4 font-semibold">Barang</th>
                      <th className="p-4 font-semibold text-center">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-4 text-slate-500">
                          {new Date(log.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          {log.nama_peminjam === "ADMIN (SO)" ? (
                            <span className="text-amber-600 bg-amber-100 px-2 py-1 rounded text-xs">ADMIN (SO)</span>
                          ) : log.nama_peminjam}
                        </td>
                        <td className="p-4 text-slate-600">{log.part_name}</td>
                        <td className="p-4 text-center font-bold">
                          <span className={log.jumlah < 0 ? "text-red-600" : "text-green-600"}>
                            {log.jumlah > 0 ? `+${log.jumlah}` : log.jumlah}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {historyList.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada riwayat transaksi.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: TAMBAH / EDIT BARANG (POPUP) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b bg-slate-800 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg">{editId ? "Edit Data Barang" : "Tambah Barang Baru"}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white font-bold text-xl leading-none">×</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSimpanBarang}>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Barang *</label>
                  <input type="text" required value={formData.part_name} onChange={(e) => setFormData({...formData, part_name: e.target.value})} className="w-full border border-slate-300 rounded p-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Contoh: Krytox Grease" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Part Number</label>
                    <input type="text" value={formData.part_number} onChange={(e) => setFormData({...formData, part_number: e.target.value})} className="w-full border border-slate-300 rounded p-2" placeholder="Opsional..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{editId ? "Stok Aktual *" : "Stok Awal *"}</label>
                    <input type="number" required min="0" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} className="w-full border border-slate-300 rounded p-2" placeholder="0" />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Lokasi Rak / Drawer</label>
                  <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full border border-slate-300 rounded p-2" placeholder="Contoh: DRAWER A" />
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Barcode ID / UUID *</label>
                  <p className="text-xs text-slate-500 mb-2">Kode unik yang tertempel pada fisik barang.</p>
                  <div className="flex gap-2">
                    <input type="text" required value={formData.barcode_id} onChange={(e) => setFormData({...formData, barcode_id: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm font-mono" placeholder="Masukkan / Generate kode..." />
                    <button type="button" onClick={handleGenerateUUID} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded text-sm font-bold shrink-0">
                      Generate
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2 border-t mt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded">Batal</button>
                  <button type="submit" disabled={isSavingItem} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 flex justify-center items-center">
                    {isSavingItem ? "Menyimpan..." : (editId ? "Update Barang" : "Simpan Barang")}
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