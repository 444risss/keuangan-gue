import React, { useState, useMemo, useEffect } from 'react';
import { Home, PlusSquare, List, Lightbulb, TrendingUp, TrendingDown, ArrowLeft, Trash2, Sparkles, Wand2, Bot } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- STYLING CONSTANTS (Neo Brutalism) ---
const brutalBox = "border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white";
const brutalInput = "border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white px-4 py-3 font-bold text-lg focus:outline-none focus:bg-yellow-100 transition-colors placeholder-gray-500 rounded-none";
const brutalButton = "border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black uppercase active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all rounded-none flex items-center justify-center gap-2";

// --- GEMINI API SETUP ---
const apiKey = "AIzaSyDVla2m0ntmfIISwGX98vqz7L9fDbtrKrc";

const callGemini = async (prompt, expectJson = false) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "You are a helpful AI assistant." }] },
    ...(expectJson && {
      generationConfig: { responseMimeType: "application/json" }
    })
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const cleanText = expectJson ? text.replace(/`{3}json\n?|`{3}/g, '') : text;
      return expectJson ? JSON.parse(cleanText) : cleanText;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
};

// --- FIREBASE INITIALIZATION ---
let firebaseConfig = {
  apiKey: "AIzaSyAp_f-mAGU4ckXGT0kbXLDMx2KrREBz8ZE",
  authDomain: "uangku-app-b1da3.firebaseapp.com",
  projectId: "uangku-app-b1da3",
  storageBucket: "uangku-app-b1da3.firebasestorage.app",
  messagingSenderId: "180415400422",
  appId: "1:180415400422:web:21f8bf598b063e09d6ee27",
  measurementId: "G-HNX3ZMJ66V"
};

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = (typeof __app_id !== 'undefined' ? __app_id : "aplikasi-keuangan-jujur").replace(/\//g, '-'); 

export default function App() {
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [dbError, setDbError] = useState('');

  // --- FIREBASE AUTH & DATA SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Gagal Login Firebase:", error);
        setDbError("Gagal Login. Pastikan 'Anonymous Login' sudah aktif di Firebase Authentication!");
        setIsDbLoading(false);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const txCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubscribeData = onSnapshot(txCollection, (snapshot) => {
      const dataList = [];
      snapshot.forEach(doc => {
        dataList.push({ dbId: doc.id, ...doc.data() });
      });
      dataList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(dataList);
      setIsDbLoading(false);
    }, (error) => {
      console.error("Gagal sinkronisasi data:", error);
      setDbError("Gagal mengambil data. Pastikan Firestore sudah diset ke Test Mode!");
      setIsDbLoading(false);
    });

    return () => unsubscribeData();
  }, [user]);

  // --- DERIVED STATE ---
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      if (curr.type === 'income') acc.totalIncome += curr.amount;
      else acc.totalExpense += curr.amount;
      acc.balance = acc.totalIncome - acc.totalExpense;
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [transactions]);

  // --- CRUD ACTIONS ---
  const addTransaction = async (tx) => {
    if (!user) return;
    setActiveTab('dashboard'); 
    const newId = Date.now().toString();
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', newId);
    try {
      await setDoc(docRef, { ...tx, id: newId, createdAt: new Date().toISOString() });
    } catch (e) {
      console.error("Gagal menyimpan:", e);
    }
  };

  const deleteTransaction = async (dbId) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', dbId);
    try {
      await deleteDoc(docRef);
    } catch (e) {
      console.error("Gagal menghapus:", e);
    }
  };

  const renderScreen = () => {
    if (dbError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-5 h-full">
          <div className={`${brutalBox} bg-red-400 p-8 text-center`}>
            <h2 className="font-black text-2xl uppercase text-white mb-2 tracking-tighter">Akses Ditolak</h2>
            <p className="font-bold bg-white text-black p-3 border-4 border-black">{dbError}</p>
          </div>
        </div>
      );
    }

    if (isDbLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-5 h-full">
          <div className={`${brutalBox} bg-yellow-400 p-8 text-center animate-pulse`}>
            <h2 className="font-black text-2xl uppercase tracking-tighter italic text-stone-900">Sabar Dulu...</h2>
            <p className="font-bold mt-2 uppercase text-xs">Menghubungkan ke Cloud ☁️</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return <DashboardScreen transactions={transactions} income={totalIncome} expense={totalExpense} balance={balance} navigate={setActiveTab} />;
      case 'add': return <AddTransactionScreen onAdd={addTransaction} onCancel={() => setActiveTab('dashboard')} />;
      case 'history': return <HistoryScreen transactions={transactions} onDelete={deleteTransaction} />;
      case 'insights': return <InsightsScreen transactions={transactions} income={totalIncome} expense={totalExpense} />;
      default: return <DashboardScreen />;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-stone-300 flex items-center justify-center p-0 sm:p-4 font-sans text-black overflow-hidden">
      {/* Container utama menggunakan tinggi dinamis 100dvh untuk HP */}
      <div className={`w-full sm:max-w-[420px] h-[100dvh] sm:h-[840px] ${brutalBox} flex flex-col relative overflow-hidden bg-white sm:border-4 border-0 shadow-none sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
        
        {/* Header */}
        <header className="border-b-4 border-black p-4 bg-yellow-400 flex justify-between items-center z-30 shrink-0">
          <h1 className="font-black text-2xl tracking-tighter uppercase">Keuangan Jujur</h1>
          <div className={`w-4 h-4 rounded-full ${dbError ? 'bg-red-500' : (isDbLoading ? 'bg-yellow-600 animate-pulse' : 'bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')}`}></div>
        </header>

        {/* Content Area - Scrollable */}
        <main className="flex-1 overflow-y-auto bg-stone-50 relative pb-[80px] scrollbar-hide">
          {renderScreen()}
        </main>

        {/* Navbar - Sticky at Bottom */}
        <nav className="shrink-0 w-full border-t-4 border-black bg-white flex z-30 h-20">
          <NavButton icon={<Home size={24} />} label="Beranda" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} disabled={isDbLoading || !!dbError} />
          <NavButton icon={<List size={24} />} label="Riwayat" active={activeTab === 'history'} onClick={() => setActiveTab('history')} disabled={isDbLoading || !!dbError} />
          <button 
            onClick={() => !isDbLoading && !dbError && setActiveTab('add')}
            className={`flex-1 flex flex-col items-center justify-center p-3 border-r-4 border-black bg-lime-400 hover:bg-lime-500 active:translate-y-1 active:shadow-none transition-all ${(isDbLoading || !!dbError) ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            <PlusSquare size={32} strokeWidth={2.5} />
            <span className="text-[10px] font-black uppercase">Tambah</span>
          </button>
          <NavButton icon={<Lightbulb size={24} />} label="Wawasan" active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} borderRight={false} disabled={isDbLoading || !!dbError} />
        </nav>
      </div>
    </div>
  );
}

const NavButton = ({ icon, label, active, onClick, borderRight = true, disabled }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`flex-1 flex flex-col items-center justify-center ${borderRight ? 'border-r-4 border-black' : ''} ${active ? 'bg-black text-white' : 'bg-white text-black'} ${disabled ? 'opacity-50 grayscale' : 'hover:bg-gray-100'} transition-colors`}
  >
    {icon}
    <span className="text-[10px] font-black mt-1 uppercase">{label}</span>
  </button>
);

const DashboardScreen = ({ transactions, income, expense, balance, navigate }) => {
  const recent = transactions.slice(0, 3);
  return (
    <div className="p-4 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`${brutalBox} bg-cyan-300 p-6 flex flex-col items-center`}>
        <h2 className="font-black uppercase text-xs mb-1 border-b-2 border-black pb-1 w-full text-center tracking-wide">Saldo Dompet</h2>
        <p className={`text-4xl font-black mt-2 tracking-tighter ${balance < 0 ? 'text-red-600' : 'text-black'}`}>
          Rp {balance.toLocaleString('id-ID')}
        </p>
      </div>
      <div className="flex gap-3">
        <div className={`${brutalBox} bg-white flex-1 p-3 overflow-hidden`}>
          <div className="flex items-center gap-2 mb-1 text-green-600">
            <TrendingUp size={16} strokeWidth={3} />
            <span className="font-black uppercase text-[10px]">Masuk</span>
          </div>
          <p className="font-black text-base truncate italic text-stone-900">Rp {income.toLocaleString('id-ID')}</p>
        </div>
        <div className={`${brutalBox} bg-pink-400 flex-1 p-3 overflow-hidden`}>
          <div className="flex items-center gap-2 mb-1 text-black">
            <TrendingDown size={16} strokeWidth={3} />
            <span className="font-black uppercase text-[10px]">Keluar</span>
          </div>
          <p className="font-black text-base truncate italic text-stone-900">Rp {expense.toLocaleString('id-ID')}</p>
        </div>
      </div>
      <button onClick={() => navigate('add')} className={`${brutalButton} bg-lime-400 w-full py-4 text-xl tracking-tight`}>
        <PlusSquare size={24} /> Catat Pengeluaran
      </button>
      <div>
        <h3 className="font-black uppercase text-lg mb-3 flex items-center justify-between italic text-stone-800 tracking-tighter">
          Transaksi Terakhir
          <button onClick={() => navigate('history')} className="text-xs border-b-2 border-black uppercase font-black">Semua</button>
        </h3>
        <div className="flex flex-col gap-3">
          {recent.map(tx => <TransactionItem key={tx.dbId} tx={tx} />)}
          {recent.length === 0 && <div className={`${brutalBox} p-6 text-center bg-gray-100 font-bold uppercase text-sm`}>Masih Kosong Bro.</div>}
        </div>
      </div>
    </div>
  );
};

const AddTransactionScreen = ({ onAdd, onCancel }) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [magicText, setMagicText] = useState('');
  const [isMagicLoading, setIsMagicLoading] = useState(false);

  const categories = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Lainnya'];

  const handleMagicSubmit = async () => {
    if (!magicText) return;
    setIsMagicLoading(true);
    try {
      const prompt = `Ekstrak informasi transaksi ini ke JSON. Properti: "amount" (angka bulat), "category" (pilih: Makanan, Transportasi, Belanja, Tagihan, Pemasukan, Lainnya), "type" (pilih: income atau expense), "note" (keterangan). Teks: "${magicText}"`;
      const result = await callGemini(prompt, true);
      if (result.type) setType(result.type);
      if (result.amount) setAmount(result.amount.toString());
      if (result.category && result.category !== 'Pemasukan') setCategory(result.category);
      if (result.note) setNote(result.note);
      setMagicText('');
    } catch (e) {
      alert("AI Gagal. Cek koneksi atau API Key bro.");
    } finally {
      setIsMagicLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount)) return alert("Isi nominal yang bener.");
    onAdd({ type, amount: parseFloat(amount), category: type === 'income' ? 'Pemasukan' : (category || 'Lainnya'), note, date });
  };

  return (
    <div className="flex flex-col animate-in slide-in-from-right-full duration-300">
      <div className="p-4 flex gap-2">
        <button type="button" onClick={onCancel} className={`${brutalButton} bg-white p-2`}>
          <ArrowLeft size={20} />
        </button>
        <h2 className={`${brutalBox} flex-1 flex items-center justify-center font-black uppercase text-lg bg-yellow-400 italic tracking-tighter`}>
          Tambah Catatan
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pb-4 flex flex-col gap-4">
        {/* Magic AI */}
        <div className={`${brutalBox} bg-purple-300 p-3`}>
          <label className="font-black uppercase text-[10px] flex items-center gap-1 mb-2">
            <Sparkles size={14} /> Catat Otomatis via AI
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Contoh: kopi 15rb"
              value={magicText}
              onChange={(e) => setMagicText(e.target.value)}
              className="flex-1 border-4 border-black p-2 font-bold focus:outline-none rounded-none text-sm"
            />
            <button 
              type="button" 
              onClick={handleMagicSubmit}
              disabled={isMagicLoading}
              className={`border-4 border-black font-black px-4 bg-black text-white transition-all ${isMagicLoading ? 'opacity-50' : 'active:translate-x-1 active:translate-y-1'}`}
            >
              {isMagicLoading ? '...' : <Wand2 size={20} />}
            </button>
          </div>
        </div>

        {/* Manual Form */}
        <div className="flex font-black text-sm">
          <button type="button" onClick={() => setType('expense')} className={`flex-1 py-3 border-4 border-black border-r-2 ${type === 'expense' ? 'bg-pink-400' : 'bg-gray-200'}`}>KELUAR</button>
          <button type="button" onClick={() => setType('income')} className={`flex-1 py-3 border-4 border-black border-l-2 ${type === 'income' ? 'bg-green-400' : 'bg-gray-200'}`}>MASUK</button>
        </div>

        <div className="relative">
          <span className="absolute left-4 top-3 font-black text-xl italic">Rp</span>
          <input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${brutalInput} w-full pl-12 text-xl h-14`} />
        </div>

        {type === 'expense' && (
          <div className="grid grid-cols-2 gap-2 text-stone-900">
            {categories.map(cat => (
              <button
                type="button" key={cat} onClick={() => setCategory(cat)}
                className={`border-2 border-black p-2 font-bold uppercase transition-all text-xs ${category === cat ? 'bg-black text-white translate-x-1 translate-y-1 shadow-none' : 'bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <input type="text" placeholder="Catatan Tambahan" value={note} onChange={(e) => setNote(e.target.value)} className={`${brutalInput} w-full text-sm py-2`} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${brutalInput} w-full text-sm py-2`} />

        <button type="submit" className={`${brutalButton} bg-cyan-400 w-full py-4 text-xl mt-4 mb-2`}>
          Simpan Cepat
        </button>
      </form>
    </div>
  );
};

const HistoryScreen = ({ transactions, onDelete }) => {
  const [filter, setFilter] = useState('all');
  const filtered = transactions.filter(t => filter === 'all' ? true : t.type === filter);
  return (
    <div className="p-4 animate-in fade-in duration-300">
      <h2 className="font-black uppercase text-2xl mb-4 tracking-tighter italic text-stone-900">Riwayat Keuangan</h2>
      <div className="flex gap-2 mb-6">
        {['all', 'income', 'expense'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-1 border-4 border-black py-2 font-bold uppercase text-[10px] ${filter === f ? 'bg-black text-white' : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}>
            {f === 'all' ? 'Semua' : (f === 'income' ? 'Masuk' : 'Keluar')}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {filtered.map(tx => (
          <div key={tx.dbId} className="relative">
            <TransactionItem tx={tx} />
            <button onClick={() => onDelete(tx.dbId)} className="absolute -top-1 -right-1 bg-red-500 text-white border-2 border-black p-1 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none"><Trash2 size={12} /></button>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center font-black p-10 border-4 border-black border-dashed opacity-40 uppercase text-sm">Kosong Melompong</div>}
      </div>
    </div>
  );
};

const InsightsScreen = ({ transactions, income, expense }) => {
  const [aiRoast, setAiRoast] = useState('');
  const [isRoasting, setIsRoasting] = useState(false);
  const expenses = transactions.filter(t => t.type === 'expense');
  const catTotals = expenses.reduce((acc, curr) => { acc[curr.category] = (acc[curr.category] || 0) + curr.amount; return acc; }, {});
  const topCat = Object.entries(catTotals).sort((a,b) => b[1] - a[1])[0] || ['-', 0];
  const survivalRate = income > 0 ? Math.round((expense / income) * 100) : 100;

  const handleGetRoast = async () => {
    if (transactions.length === 0) return setAiRoast("Dompet masih suci, belum ada dosa belanja.");
    setIsRoasting(true);
    try {
      const prompt = `Analisis pengeluaran ini secara SARKASTIK dan BLAK-BLAKAN (Bahasa Indonesia Gaul). Pemasukan: Rp ${income}, Pengeluaran: Rp ${expense}, Kategori Terboros: ${topCat[0]}. Roasting gue maksimal 2 kalimat pedas.`;
      const result = await callGemini(prompt, false);
      setAiRoast(result);
    } catch (e) { setAiRoast("AI-nya trauma liat pengeluaran lo."); } finally { setIsRoasting(false); }
  };

  return (
    <div className="p-4 flex flex-col gap-5 animate-in zoom-in-95 duration-300">
      <h2 className="font-black uppercase text-2xl tracking-tighter italic">Fakta Pahit</h2>
      <div className={`${brutalBox} bg-purple-400 p-5`}>
        <h3 className="font-black uppercase text-base mb-3 flex items-center gap-2 italic"><Bot size={20} /> AI Roasting</h3>
        {aiRoast ? (
          <p className="font-bold text-base bg-white p-4 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] leading-tight italic">"{aiRoast}"</p>
        ) : (
          <button onClick={handleGetRoast} disabled={isRoasting} className={`${brutalButton} bg-black text-white w-full py-4 uppercase text-[10px]`}>
            {isRoasting ? 'MENYIAPKAN KATA-KATA PEDAS...' : 'CEK REALITA (ROASTING GUE)'}
          </button>
        )}
      </div>
      <div className={`${brutalBox} ${survivalRate > 80 ? 'bg-red-500 text-white' : 'bg-cyan-300'} p-5`}>
        <p className="font-black uppercase text-[10px] mb-1 italic tracking-widest">Tingkat Kebocoran</p>
        <p className="font-black text-4xl tracking-tighter">{survivalRate}%</p>
        <p className="font-bold mt-1 text-[10px] uppercase">{survivalRate > 80 ? 'Loe Jualan Ginjal Bentar Lagi' : 'Masih Aman Bro'}</p>
      </div>
      <div className={`${brutalBox} bg-white p-4`}>
        <h3 className="font-black uppercase text-sm mb-3 border-b-2 border-black pb-1 italic">Rincian Dosa</h3>
        {Object.entries(catTotals).sort((a,b) => b[1] - a[1]).map(([name, val]) => (
          <div key={name} className="flex justify-between items-center mb-2 border-b-2 border-dashed border-gray-400 pb-1">
            <span className="font-bold uppercase text-[10px] italic">{name}</span>
            <span className="font-black text-sm text-stone-900">Rp {val.toLocaleString('id-ID')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TransactionItem = ({ tx }) => {
  const isIncome = tx.type === 'income';
  return (
    <div className={`border-4 border-black p-3 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center ${isIncome ? 'border-l-[10px] border-l-lime-400' : 'border-l-[10px] border-l-pink-400'}`}>
      <div className="overflow-hidden pr-2 text-stone-900">
        <p className="font-black uppercase text-base leading-tight truncate italic tracking-tight">{tx.category}</p>
        <p className="font-bold text-[9px] text-gray-500 uppercase mt-1 truncate tracking-tight">{tx.date} {tx.note && `| ${tx.note}`}</p>
      </div>
      <p className={`font-black text-base whitespace-nowrap ${isIncome ? 'text-green-600' : 'text-stone-900'}`}>
        {isIncome ? '+' : '-'}Rp {tx.amount.toLocaleString('id-ID')}
      </p>
    </div>
  );
};