# 📦 GMF Inventory Control System (Stock Opname)

A modern, high-performance inventory management and stock opname system designed for **GMF AeroAsia**. This application streamlines the process of tracking inventory, managing chemicals with expiration dates, and generating QR labels for rapid identification.

---

## 🚀 Key Features

- **Dynamic Inventory Management**: Full CRUD operations for tracking parts, locations, and quantities.
- **QR Label System**: 
  - Generate individual or bulk QR codes for every item.
  - Professional print layouts optimized for thermal or standard printers.
- **Location-Based Tracking**: 
  - Group inventory by physical location/drawer.
  - Print location-specific checklists for physical stock counts.
- **Smart Expiration Monitoring**: 
  - Real-time tracking of chemical expiration dates.
  - Visual indicators and warnings for expired or near-expiry stock.
- **Rapid QR Scanner**: Integrated scanner for quick item identification and inventory lookup.
- **Modern UI/UX**: Responsive dashboard built with a sleek dark-themed interface.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime)
- **QR Engine**: [Html5-QRCode](https://github.com/mebjas/html5-qrcode)
- **Deployment**: Optimized for Vercel

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/stock-opname-project.git
   cd stock-opname-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

## 📖 Usage

- **Inventory Tab**: View the master list, search by part name or number, and add new items.
- **Printing**:
  - Click **"📋 Cetak Label Lokasi"** for a summarized list grouped by location with expiration status.
  - Click **"🖨️ Cetak Semua QR"** to generate labels for all current items.
- **Scanning**: Use the camera interface to scan item QR codes for instant data retrieval.

## 🤝 Contribution

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for GMF AeroAsia Inventory Control.*
