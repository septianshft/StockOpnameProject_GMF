<div>
  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Expired Date</label>
  <input 
    type="date" 
    value={formData.expired_date} 
    onChange={(e) => setFormData({...formData, expired_date: e.target.value})} 
    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" 
  />
</div>