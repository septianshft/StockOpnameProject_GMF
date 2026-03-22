"use client";

import { useState, useEffect, useMemo } from "react";
import QRScanner from "@/components/QRScanner";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  // State Keamanan (PIN)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const PIN_RAHASIA = "123456";

  // State Navigasi Layout & Sidebar
  const [activeTab, setActiveTab] = useState("dashboard"); // Default ke Dashboard kosong
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // State Tab 1: Scanner (SO)
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [itemData, setItemData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stokFisik, setStokFisik] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Tab 2, 3, 4: Data Master, History, Requests
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // State baru untuk pencarian
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [requestList, setRequestList] = useState<any[]>([]); // State baru untuk request
  const [isLoadingData, setIsLoadingData] = useState(false);

  // === LOGIKA STATISTIK DASHBOARD ===
  const dashboardStats = useMemo(() => {
    const lowStockCount = inventoryList.filter(item => Number(item.quantity) <= 5).length;
    const pendingReqCount = requestList.filter(req => req.status === "PENDING").length;
    const actualBorrowings = historyList.filter(log => log.nama_peminjam !== "ADMIN (SO)" && log.jumlah > 0);

    const itemFreq: Record<string, number> = {};
    actualBorrowings.forEach(log => { itemFreq[log.part_name] = (itemFreq[log.part_name] || 0) + log.jumlah; });
    const topItems = Object.entries(itemFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxItemCount = topItems.length > 0 ? topItems[0][1] : 1;

    // LOGIKA BARU: Grouping pakai NIK
    const userFreq: Record<string, number> = {};
    actualBorrowings.forEach(log => {
      // Gabungkan Nama dan NIK sebagai kunci biar terbaca jelas di grafik
      // Jika NIK kosong (data lama), pakai namanya saja
      const userKey = log.nomor_pegawai ? `${log.nama_peminjam} (${log.nomor_pegawai})` : log.nama_peminjam;
      userFreq[userKey] = (userFreq[userKey] || 0) + 1;
    });
    const topUsers = Object.entries(userFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxUserCount = topUsers.length > 0 ? topUsers[0][1] : 1;

    return { lowStockCount, pendingReqCount, topItems, maxItemCount, topUsers, maxUserCount, totalBorrowings: actualBorrowings.length };
  }, [inventoryList, historyList, requestList]);

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
      fetchInventory();
      fetchHistory();
      fetchRequests();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === "inventory") fetchInventory();
      if (activeTab === "history") fetchHistory();
      if (activeTab === "requests") fetchRequests();
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

  // === FUNGSI BARU: FETCH REQUEST ===
  const fetchRequests = async () => {
    setIsLoadingData(true);
    const { data } = await supabase.from("item_requests").select("*").order("status", { ascending: true }).order("created_at", { ascending: false });
    if (data) setRequestList(data);
    setIsLoadingData(false);
  };

  const handleSelesaikanRequest = async (id: number, namaBarang: string) => {
    const isConfirm = window.confirm(`Tandai request "${namaBarang}" sebagai SELESAI?`);
    if (!isConfirm) return;
    try {
      const { error } = await supabase.from("item_requests").update({ status: 'SELESAI' }).eq("id", id);
      if (error) throw error;
      fetchRequests();
    } catch (err) {
      alert("Gagal mengupdate status request.");
    }
  };

  const handleHapusRequest = async (id: number) => {
    if (!window.confirm("Hapus log request ini dari database?")) return;
    try {
      await supabase.from("item_requests").delete().eq("id", id);
      fetchRequests();
    } catch (err) {
      alert("Gagal menghapus request.");
    }
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

  // --- FUNGSI CETAK ---
  const handleCetakQR = (item: any) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      
      let itemsHtml = "";
      // Ambil quantity, minimal 1 (jaga-jaga kalau stok 0 tapi admin butuh cetak 1 stiker buat nempel di rak kosong)
      const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.barcode_id)}`;

      // Looping pembuatan kotak stiker sebanyak jumlah stok
      for (let i = 0; i < qty; i++) {
        itemsHtml += `
          <div class="label-box">
            <h2>${item.part_name}</h2>
            <p>PN: ${item.part_number || "-"}</p>
            <img src="${qrUrl}" alt="QR Code" />
            <div class="uuid">${item.barcode_id}</div>
          </div>
        `;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak QR - ${item.part_name}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; background-color: #f1f5f9; }
              /* Gunakan layout GRID/FLEX persis seperti fitur cetak semua */
              .grid-container { 
                display: flex; 
                flex-wrap: wrap; /* Otomatis turun ke bawah kalau 1 baris penuh */
                gap: 10px; 
                justify-content: flex-start;
              }
              .label-box { 
                background: white; border: 2px solid #000; padding: 10px; 
                text-align: center; border-radius: 8px; page-break-inside: avoid;
                width: 160px; /* Ukuran kotak dikunci */
              }
              h2 { margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              p { margin: 0 0 10px 0; font-size: 10px; color: #333; font-weight: bold; }
              img { width: 100px; height: 100px; margin: 0 auto; display: block; }
              .uuid { margin-top: 10px; font-family: monospace; font-size: 8px; color: #555; word-break: break-all; }
              .header { text-align: center; margin-bottom: 20px; }
              .print-btn { padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(37,99,235,0.3); }
              
              /* CSS Khusus Print agar hemat kertas */
              @media print {
                @page { margin: 5mm; }
                body { background: white; padding: 0; margin: 0; }
                .header, .no-print { display: none !important; }
                .label-box { border: 1px dashed #999; border-radius: 0; }
              }
            </style>
          </head>
          <body>
            <div class="header no-print">
              <h1>Cetak ${qty} Stiker untuk ${item.part_name}</h1>
              <p>Pastikan gambar QR Code sudah termuat sebelum klik tombol cetak di bawah.</p>
              <button class="print-btn" onclick="window.print()">🖨️ Cetak Stiker Sekarang</button>
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

  const handleCetakSemuaQR = () => {
    if (inventoryList.length === 0) return alert("Belum ada barang di database!");

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      
      // PERBAIKAN LOGIKA LOOPING BERDASARKAN QTY BARANG
      let itemsHtml = "";
      let totalStikerDicetak = 0;

      inventoryList.forEach(item => {
        const qty = Number(item.quantity) || 0;
        // Ulangi pembuatan HTML box sebanyak jumlah stok barang tersebut
        for (let i = 0; i < qty; i++) {
          totalStikerDicetak++;
          itemsHtml += `
            <div class="label-box">
              <h2>${item.part_name}</h2>
              <p>PN: ${item.part_number || "-"}</p>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.barcode_id)}" alt="QR Code" />
              <div class="uuid">${item.barcode_id}</div>
            </div>
          `;
        }
      });

      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak Semua QR Code</title>
            <style>
              body { font-family: sans-serif; padding: 20px; background-color: #f1f5f9; }
              .grid-container { 
                display: flex; 
                flex-wrap: wrap; /* Supaya turun ke bawah kalau penuh */
                gap: 10px; 
              }
              .label-box { 
                background: white; border: 2px solid #000; padding: 10px; 
                text-align: center; border-radius: 8px; page-break-inside: avoid;
                width: 160px; /* Ukuran statis biar seragam */
              }
              h2 { margin: 0 0 5px 0; font-size: 14px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
              p { margin: 0 0 10px 0; font-size: 10px; color: #333; font-weight: bold; }
              img { width: 100px; height: 100px; margin: 0 auto; display: block; }
              .uuid { margin-top: 10px; font-family: monospace; font-size: 8px; color: #555; word-break: break-all; }
              .header { text-align: center; margin-bottom: 20px; }
              .print-btn { padding: 12px 24px; cursor: pointer; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(37,99,235,0.3); }
              
              /* PERBAIKAN CSS PRINT MASAL */
              @media print {
                @page { margin: 5mm; }
                body { background: white; padding: 0; margin: 0; }
                .header, .no-print { display: none !important; }
                .label-box { border: 1px dashed #999; border-radius: 0; }
              }
            </style>
          </head>
          <body>
            <div class="header no-print">
              <h1>Total ${totalStikerDicetak} Stiker QR Siap Cetak</h1>
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

  // Filter list inventory berdasarkan pencarian (Nama atau PN)
  const filteredInventory = inventoryList.filter(item => 
    item.part_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.part_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg transition-all active:scale-95">Masuk</button>
          </form>
          <a href="/" className="block mt-6 text-sm text-slate-500 hover:text-slate-800 underline">Kembali ke Peminjaman Karyawan</a>
        </div>
      </div>
    );
  }

  // Navigasi Item Helper
  const NavItem = ({ id, icon, label }: { id: string, icon: string, label: string }) => (
    <button 
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-4 px-6 py-4 transition-all duration-200 border-l-4 ${
        activeTab === id 
          ? "bg-blue-600/10 border-blue-600 text-blue-600" 
          : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* SIDEBAR (DESKTOP & MOBILE) */}
      {/* Overlay untuk Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Panel Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700 shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out flex flex-col ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="p-8 border-b border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-inner text-white text-2xl">
            🛠️
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white">GMF Admin</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Control Center</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1">
          <NavItem id="dashboard" icon="📊" label="Overview" />
          <NavItem id="scanner" icon="🔍" label="Audit (SO)" />
          <NavItem id="inventory" icon="📦" label="Master Stok" />
          <NavItem id="history" icon="📜" label="Log Riwayat" />
          <NavItem id="requests" icon="📥" label="Antrean Request" />
        </nav>

        <div className="p-6 border-t border-slate-700">
          <button 
            onClick={() => setIsAuthenticated(false)} 
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white font-bold py-3 rounded-xl transition-colors text-sm border-2 border-red-500 hover:border-red-700"
          >
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* HEADER BARS (Mobile Hamburger + Page Title) */}
        <header className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <h2 className="text-xl font-black text-slate-100 tracking-tight capitalize">
              {activeTab === "scanner" ? "Audit Stock Opname" : activeTab.replace("-", " ")}
            </h2>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">

            {/* TAB 0: DASHBOARD OVERVIEW */}
            {activeTab === "dashboard" && (
              <div className="space-y-8 animate-in fade-in duration-700">
                {/* 1. STATS ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">📦</div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Barang</p><p className="text-2xl font-black text-slate-900">{inventoryList.length}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stok Menipis</p><p className="text-2xl font-black text-slate-900">{dashboardStats.lowStockCount}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-2xl">⏳</div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Req</p><p className="text-2xl font-black text-slate-900">{dashboardStats.pendingReqCount}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center text-2xl">📜</div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transaksi</p><p className="text-2xl font-black text-slate-900">{dashboardStats.totalBorrowings}</p></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 2. TOP ITEMS CHART */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">🔥</div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">Barang Paling Sering Diambil</h3>
                    </div>
                    <div className="space-y-6">
                      {dashboardStats.topItems.map(([name, count]) => (
                        <div key={name} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500"><span>{name}</span><span>{count} Unit</span></div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${(count / dashboardStats.maxItemCount) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                      {dashboardStats.topItems.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">Belum ada data pengambilan.</p>}
                    </div>
                  </div>

                  {/* 3. TOP USERS CHART */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">👤</div>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight">Peminjam Teraktif</h3>
                    </div>
                    <div className="space-y-6">
                      {dashboardStats.topUsers.map(([user, count]) => (
                        <div key={user} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500"><span>{user}</span><span>{count} Kali</span></div>
                          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 rounded-full transition-all duration-1000" style={{ width: `${(count / dashboardStats.maxUserCount) * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                      {dashboardStats.topUsers.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">Belum ada data peminjam.</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* TAB 1: SCANNER SO */}
            {activeTab === "scanner" && (
          <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isScanning && !isLoadingScan && !itemData && !errorMsg && (
              <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 text-center group">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-4xl">📷</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Mulai Stock Opname</h3>
                <p className="text-slate-500 text-sm mb-8">Arahkan kamera ke QR Code untuk melakukan audit fisik barang.</p>
                <button 
                  onClick={() => setIsScanning(true)} 
                  className="w-full bg-slate-900 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  AKTIFKAN KAMERA
                </button>
              </div> 
            )}
            {isScanning && (
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 text-center animate-in zoom-in-95 duration-300">
                <div className="mb-4 flex items-center justify-center gap-2 text-slate-500 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Scanning in progress...
                </div>
                <QRScanner onScanSuccess={handleScanSuccess} />
                <button 
                  onClick={() => setIsScanning(false)} 
                  className="mt-6 w-full bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 font-bold py-3 rounded-xl transition-colors"
                >
                  Batal
                </button>
              </div>
            )}
            {isLoadingScan && (
              <div className="bg-white p-20 rounded-3xl shadow-xl border border-slate-200 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500 font-bold">Mencari data barang...</p>
              </div>
            )}
            {errorMsg && !isLoadingScan && (
              <div className="bg-white p-10 rounded-3xl shadow-xl border border-red-100 text-center animate-in shake duration-500">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-lg font-bold text-red-600 mb-2">Terjadi Masalah</h3>
                <p className="text-slate-500 text-sm mb-6">{errorMsg}</p>
                <button 
                  onClick={resetScanTampilan} 
                  className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Coba Lagi
                </button>
              </div>
            )}
            {itemData && !isLoadingScan && (
              <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <div className="bg-slate-900 p-8 text-white relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">Audit Item</span>
                  <h2 className="text-2xl font-black">{itemData.part_name}</h2>
                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Stok Sistem</p>
                      <p className="text-3xl font-black text-amber-400">{itemData.quantity} <span className="text-sm font-medium text-slate-400 uppercase tracking-normal">unit</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Lokasi</p>
                      <p className="text-lg font-bold text-slate-200">{itemData.location || "N/A"}</p>
                    </div>
                  </div>
                </div>
                <div className="p-8 bg-slate-50/50">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Input Stok Fisik Aktual</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={stokFisik} 
                      onChange={(e) => setStokFisik(e.target.value ? Number(e.target.value) : "")} 
                      className="w-full bg-white border-2 border-slate-200 focus:border-blue-500 rounded-2xl p-6 text-3xl font-black text-center text-slate-900 transition-all outline-none shadow-sm" 
                      placeholder="0" 
                      autoFocus 
                    />
                  </div>
                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={resetScanTampilan} 
                      className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 py-4 rounded-2xl font-bold transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleUpdateStok} 
                      disabled={isSubmitting} 
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                      {isSubmitting ? "Updating..." : "SESUAIKAN"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MASTER STOK */}
        {activeTab === "inventory" && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden animate-in fade-in duration-500">
            <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-slate-50/30">
              <div className="flex-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daftar Barang</h2>
                <p className="text-sm text-slate-500 font-medium">Manajemen data master dan pencetakan QR Code.</p>
              </div>

              {/* BAR PENCARIAN BARU */}
              <div className="relative w-full lg:max-w-xs group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  🔍
                </span>
                <input 
                  type="text" 
                  placeholder="Cari Nama atau PN..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                />
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto shrink-0">
                <button 
                  onClick={handleCetakSemuaQR} 
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-bold py-3 px-5 rounded-xl transition-all shadow-sm"
                >
                  <span>🖨️</span> Cetak Semua
                </button>
                <button 
                  onClick={openAddModal} 
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 px-5 rounded-xl transition-all shadow-lg shadow-blue-200"
                >
                  <span>+</span> Tambah Barang
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {isLoadingData ? (
                <div className="py-20 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400 font-medium">Memuat database...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5 border-b border-slate-100">Info Barang</th>
                      <th className="px-8 py-5 border-b border-slate-100">Part Number</th>
                      <th className="px-8 py-5 border-b border-slate-100 text-center">Lokasi</th>
                      <th className="px-8 py-5 border-b border-slate-100 text-center">Stok</th>
                      <th className="px-8 py-5 border-b border-slate-100 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-8 py-6">
                          <p className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">{item.part_name}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-[150px]">{item.barcode_id}</p>
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-slate-500">
                          {item.part_number || "—"}
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                            {item.location || "N/A"}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className={`inline-block min-w-[3rem] py-1 px-3 rounded-full font-black text-sm ${
                            Number(item.quantity) <= 5 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"
                          }`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-end items-center gap-4">
                            <button onClick={() => handleCetakQR(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Cetak QR">
                              🖨️
                            </button>
                            <button onClick={() => openEditModal(item)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Edit">
                              ✏️
                            </button>
                            <button onClick={() => handleHapusBarang(item.id, item.part_name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Hapus">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="text-4xl mb-4">�</div>
                          <p className="text-slate-400 font-bold">Barang tidak ditemukan.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RIWAYAT TRANSAKSI */}
        {activeTab === "history" && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden animate-in fade-in duration-500">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Log Aktivitas</h2>
              <p className="text-sm text-slate-500 font-medium">Pantau pergerakan stok dan penyesuaian audit.</p>
            </div>
            
            <div className="overflow-x-auto">
              {isLoadingData ? (
                <div className="py-20 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-green-600 rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400 font-medium">Memuat histori...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5 border-b border-slate-100">Waktu & Tanggal</th>
                      <th className="px-8 py-5 border-b border-slate-100">User / Peminjam</th>
                      <th className="px-8 py-5 border-b border-slate-100">Detail Item</th>
                      <th className="px-8 py-5 border-b border-slate-100 text-right">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {historyList.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-slate-700">
                            {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                            {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          {log.nama_peminjam === "ADMIN (SO)" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-100">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              Audit Admin
                            </span>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-xs font-black text-blue-600 uppercase">
                                {log.nama_peminjam?.charAt(0) || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-extrabold text-slate-900">{log.nama_peminjam}</p>
                                <p className="text-[10px] font-mono text-slate-500 mt-0.5">NIK: {log.nomor_pegawai || "—"}</p>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-slate-800">{log.part_name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{log.part_number || "No Part Number"}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className={`inline-flex items-center justify-end font-black text-sm ${
                            log.jumlah < 0 ? "text-red-600" : "text-green-600"
                          }`}>
                            {log.jumlah > 0 ? (
                              <span className="mr-1">▲</span>
                            ) : (
                              <span className="mr-1">▼</span>
                            )}
                            {Math.abs(log.jumlah)}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {historyList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-20 text-center">
                          <div className="text-4xl mb-4">📜</div>
                          <p className="text-slate-400 font-bold">Belum ada riwayat aktivitas.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: REQUEST BARANG (FITUR BARU) */}
        {activeTab === "requests" && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden animate-in fade-in duration-500">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Antrean Request</h2>
              <p className="text-sm text-slate-500 font-medium">Kelola pengajuan stok barang dari karyawan.</p>
            </div>
            
            <div className="overflow-x-auto">
              {isLoadingData ? (
                <div className="py-20 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-purple-600 rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400 font-medium">Memuat data request...</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5 border-b border-slate-100">Tanggal</th>
                      <th className="px-8 py-5 border-b border-slate-100">Info Request</th>
                      <th className="px-8 py-5 border-b border-slate-100">Keterangan</th>
                      <th className="px-8 py-5 border-b border-slate-100 text-center">Status</th>
                      <th className="px-8 py-5 border-b border-slate-100 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {requestList.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-slate-700">
                            {new Date(req.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                            {new Date(req.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-extrabold text-slate-900">{req.nama_barang}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-md text-[10px] font-black">{req.jumlah} unit</span>
                            <span className="text-xs text-slate-500 font-medium">oleh {req.nama_peminjam}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-xs text-slate-600 italic max-w-xs">{req.keterangan || "-"}</p>
                        </td>
                        <td className="px-8 py-6 text-center">
                          {req.status === "PENDING" ? (
                            <span className="inline-block px-3 py-1 bg-amber-50 border border-amber-200 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                              ⏳ PENDING
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 bg-green-50 border border-green-200 text-green-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                              ✅ SELESAI
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-end items-center gap-3">
                            {req.status === "PENDING" && (
                              <button 
                                onClick={() => handleSelesaikanRequest(req.id, req.nama_barang)} 
                                className="p-2 bg-green-50 hover:bg-green-100 text-green-600 hover:text-green-700 rounded-lg transition-all text-xs font-bold"
                                title="Tandai Selesai"
                              >
                                ✓ Selesaikan
                              </button>
                            )}
                            <button 
                              onClick={() => handleHapusRequest(req.id)} 
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" 
                              title="Hapus Log"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {requestList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="text-4xl mb-4">📥</div>
                          <p className="text-slate-400 font-bold">Yeay! Tidak ada antrean request.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

          </div>
        </main>
      </div>

      {/* MODAL: TAMBAH / EDIT BARANG (POPUP) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h2 className="font-black text-xl tracking-tight">{editId ? "Update Barang" : "Barang Baru"}</h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{editId ? "Lakukan perubahan pada data master." : "Lengkapi form untuk menambah data."}</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto">
              <form onSubmit={handleSimpanBarang} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Nama Barang *</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.part_name} 
                    onChange={(e) => setFormData({...formData, part_name: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    placeholder="Contoh: Krytox Grease" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Part Number</label>
                    <input 
                      type="text" 
                      value={formData.part_number} 
                      onChange={(e) => setFormData({...formData, part_number: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                      placeholder="Opsional" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{editId ? "Stok Aktual *" : "Stok Awal *"}</label>
                    <input 
                      type="number" 
                      required 
                      min="0" 
                      value={formData.quantity} 
                      onChange={(e) => setFormData({...formData, quantity: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                      placeholder="0" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Lokasi Rak / Drawer</label>
                  <input 
                    type="text" 
                    value={formData.location} 
                    onChange={(e) => setFormData({...formData, location: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    placeholder="Contoh: DRAWER A" 
                  />
                </div>

                <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <label className="block text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2">Barcode ID / UUID *</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      required 
                      value={formData.barcode_id} 
                      onChange={(e) => setFormData({...formData, barcode_id: e.target.value})} 
                      className="flex-1 bg-white border border-blue-200 rounded-xl p-3 text-xs font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none" 
                      placeholder="ID Unik..." 
                    />
                    <button 
                      type="button" 
                      onClick={handleGenerateUUID} 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-blue-200 shrink-0 active:scale-95"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)} 
                    className="flex-1 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-bold py-4 rounded-2xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingItem} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isSavingItem ? "Saving..." : (editId ? "UPDATE" : "SIMPAN")}
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