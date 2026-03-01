import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Camera, RefreshCw, Info, CheckCircle2, AlertCircle, Loader2, Sparkles, 
  Utensils, Zap, Scale, Heart, MessageCircle, BookOpen, LayoutDashboard, 
  User, Share2, Crown, ChevronRight, Send, Plus, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface NutriData {
  nome: string;
  calorias: number;
  proteinas: number;
  carboidratos: number;
  gorduras: number;
  fibras: number;
  sodio: number;
  objetivo_treino: string;
  aminoacidos: string;
  dica_atleta: string;
  indice_glicemico: string;
  densidade_nutritiva: number;
  tamanho_porcao: string;
}

interface UserProfile {
  id: string;
  weight: number;
  age?: number;
  gender?: string;
  height?: number;
  activity_level?: string;
  goal?: string;
  plan: 'FREE_TRIAL' | 'START' | 'PLUS';
  trial_start: string;
  avatar?: string;
  created_at: string;
}

interface Message {
  id: number;
  user_id: string;
  text: string;
  type: string;
  sender: 'user' | 'system';
  created_at: string;
}

interface EduContent {
  id: number;
  title: string;
  content: string;
  category: string;
  image_url?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'dashboard' | 'chat' | 'learn' | 'profile'>('scanner');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<NutriData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(localStorage.getItem('nutriq_user_id'));
  const [showLoginModal, setShowLoginModal] = useState(!localStorage.getItem('nutriq_user_id'));
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [eduContent, setEduContent] = useState<EduContent[]>([]);
  const [scans, setScans] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
      fetchUserData(userId);
      fetchMessages(userId);
      fetchContent();
      fetchScans(userId);
      startCamera();
    }
    return () => stopCamera();
  }, [userId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchUserData = async (id: string) => {
    try {
      const res = await fetch(`/api/user/${id}`);
      const data = await res.json();
      setUserProfile(data);
      
      // Check trial expiration
      const trialStart = new Date(data.trial_start);
      const now = new Date();
      const diffDays = Math.ceil((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays > 5 && data.plan === 'FREE_TRIAL') {
        setShowPlanModal(true);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do usuário:", err);
    }
  };

  const fetchMessages = async (id: string) => {
    const res = await fetch(`/api/messages/${id}`);
    const data = await res.json();
    setMessages(data);
  };

  const fetchContent = async () => {
    const res = await fetch(`/api/content`);
    const data = await res.json();
    setEduContent(data);
  };

  const fetchScans = async (id: string) => {
    const res = await fetch(`/api/scans/${id}`);
    const data = await res.json();
    setScans(data);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const res = await fetch(`/api/user/${userId}/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64 })
        });
        if (res.ok) {
          fetchUserData(userId);
        }
      } catch (err) {
        console.error("Error uploading avatar:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userId) return;
    try {
      await fetch(`/api/user/${userId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      fetchUserData(userId);
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
    }
  };

  const sendMessage = async (text: string) => {
    if (!userId || !text.trim()) return;
    try {
      await fetch(`/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, text, sender: 'user' })
      });
      fetchMessages(userId);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    }
  };

  const handleLogin = async (id: string) => {
    const cleanId = id.trim().toLowerCase();
    if (cleanId) {
      localStorage.setItem('nutriq_user_id', cleanId);
      setUserId(cleanId);
      setShowLoginModal(false);
      
      // Send welcome message if new
      const res = await fetch(`/api/messages/${cleanId}`);
      const data = await res.json();
      if (data.length === 0) {
        await fetch(`/api/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            user_id: cleanId, 
            text: "Bem-vindo ao NutriQ! 👋 Sou seu assistente de performance. Tire fotos das suas refeições para começar a acompanhar seu déficit calórico.", 
            sender: 'system' 
          })
        });
        fetchMessages(cleanId);
      }
    }
  };

  const isPlus = userProfile?.plan === 'PLUS' || (userProfile?.plan === 'FREE_TRIAL' && !showPlanModal);
  const isStart = userProfile?.plan === 'START' || isPlus;

  const startCamera = async () => {
    setHasPermission(null);
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Seu navegador não suporta acesso à câmera.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Acesso à câmera negado. Por favor, habilite as permissões nas configurações do seu navegador.");
      } else {
        setError("Erro ao acessar a câmera: " + (err.message || "Erro desconhecido"));
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setImage(base64);
        setIsCameraActive(false);
        analisarComIA(base64.split(',')[1]);
      }
    }
  };

  const analisarComIA = async (base64Data: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Aja como um Nutricionista Esportivo. Analise a imagem para um atleta. Retorne um JSON com os campos: nome (string), calorias (number), proteinas (number), carboidratos (number), gorduras (number), fibras (number), sodio (number), objetivo_treino (string, ex: 'Excelente Pós-Treino'), aminoacidos (string, destaque se é proteína de alto valor biológico), dica_atleta (string, ex: 'Adicione 20g de carbo para melhor absorção desta proteína'), indice_glicemico (string, 'Baixo', 'Médio' ou 'Alto'), densidade_nutritiva (number, 1-10), tamanho_porcao (string, ex: '200g'). Use dados REAIS da tabela TACO/USDA. Responda em Português." },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nome: { type: Type.STRING },
              calorias: { type: Type.NUMBER },
              proteinas: { type: Type.NUMBER },
              carboidratos: { type: Type.NUMBER },
              gorduras: { type: Type.NUMBER },
              fibras: { type: Type.NUMBER },
              sodio: { type: Type.NUMBER },
              objetivo_treino: { type: Type.STRING },
              aminoacidos: { type: Type.STRING },
              dica_atleta: { type: Type.STRING },
              indice_glicemico: { type: Type.STRING },
              densidade_nutritiva: { type: Type.NUMBER },
              tamanho_porcao: { type: Type.STRING },
            },
            required: ["nome", "calorias", "proteinas", "carboidratos", "gorduras", "fibras", "sodio", "objetivo_treino", "aminoacidos", "dica_atleta", "indice_glicemico", "densidade_nutritiva", "tamanho_porcao"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      setResultado(data);

      // Save to history
      if (userId) {
        await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            food_name: data.nome,
            calories: data.calorias,
            protein: data.proteinas,
            carbs: data.carboidratos,
            fats: data.gorduras,
            portion_size: data.tamanho_porcao
          })
        });
        fetchScans(userId);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Não foi possível analisar o alimento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImage(base64);
        setIsCameraActive(false);
        setHasPermission(true);
        analisarComIA(base64.split(',')[1]);
      };
      reader.readAsDataURL(file);
    }
  };

  const reset = () => {
    setImage(null);
    setResultado(null);
    setIsCameraActive(true);
    setError(null);
    startCamera();
  };

  const userWeight = userProfile?.weight || 80;
  const proteinPerKg = resultado ? (resultado.proteinas / userWeight).toFixed(2) : 0;
  const proteinGoalPercentage = resultado ? Math.min(100, Math.round((resultado.proteinas / (userWeight * 2)) * 100)) : 0;

  if (hasPermission === false) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Acesso à Câmera Necessário</h1>
          <p className="text-zinc-400 mb-6">
            {error || "Precisamos de acesso à sua câmera para escanear os alimentos."}
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={startCamera}
              className="px-6 py-3 bg-pink-500 text-white rounded-full font-semibold hover:bg-pink-600 transition-colors"
            >
              Tentar Novamente
            </button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
            >
              <Utensils className="w-4 h-4" />
              Enviar Foto Manualmente
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white/10 text-white rounded-full font-semibold hover:bg-white/20 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
          <p className="mt-8 text-xs text-zinc-500">
            Dica: Se estiver no celular, você pode tirar uma foto e enviá-la aqui se a câmera direta não funcionar.
          </p>
        </div>
      </div>
    );
  }

  if (hasPermission === null && isCameraActive) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Iniciando Câmera...</h1>
          <p className="text-zinc-400">Aguarde enquanto preparamos o scanner.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-pink-500/30 flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-black/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Zap className="text-white w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block leading-none">Nutri<span className="text-pink-500">Q</span></span>
            <span className="text-[10px] font-bold text-pink-500 uppercase tracking-[0.2em]">
              {userProfile?.plan === 'PLUS' ? 'Fitness Pro' : userProfile?.plan === 'START' ? 'Start' : 'Trial'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {userProfile?.plan !== 'PLUS' && (
            <button 
              onClick={() => setShowPlanModal(true)}
              className="p-2 px-4 bg-pink-500 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-pink-500/20 animate-pulse"
            >
              <Crown className="w-3 h-3" />
              Upgrade
            </button>
          )}
          <button 
            onClick={() => setActiveTab('profile')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all"
          >
            <User className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'scanner' && (
            <motion.div 
              key="scanner"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex flex-col"
            >
              {/* Camera/Preview Section */}
              <section className="relative flex-1 flex flex-col items-center justify-center overflow-hidden min-h-[400px]">
                <AnimatePresence mode="wait">
                  {isCameraActive ? (
                    <motion.div 
                      key="camera"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="relative w-full h-full flex items-center justify-center"
                    >
                      <video 
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Scanning UI Overlay */}
                      <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
                        <div className="relative w-64 h-64 border-2 border-pink-500/50 rounded-3xl">
                          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-pink-500 rounded-tl-xl" />
                          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-pink-500 rounded-tr-xl" />
                          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-pink-500 rounded-bl-xl" />
                          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-pink-500 rounded-br-xl" />
                          
                          <motion.div 
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="absolute left-0 right-0 h-0.5 bg-pink-500 shadow-[0_0_15px_rgba(255,45,85,0.8)]"
                          />
                        </div>
                      </div>

                      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4">
                        <p className="text-white/80 text-sm font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                          Escanear Prato de Performance
                        </p>
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
                          >
                            <Utensils className="w-5 h-5 text-white" />
                          </button>
                          
                          <button 
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-90 transition-transform"
                          >
                            <div className="w-16 h-16 bg-pink-500 rounded-full group-hover:scale-95 transition-transform" />
                          </button>

                          <div className="w-12 h-12" />
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative w-full h-full"
                    >
                      {image && <img src={image} className="w-full h-full object-cover" alt="Captured food" />}
                      {loading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                          <Loader2 className="w-12 h-12 text-pink-500 animate-spin mb-4" />
                          <h2 className="text-xl font-bold mb-2">Análise de Performance...</h2>
                          <p className="text-zinc-400 max-w-xs">Calculando macros e densidade nutritiva para seu treino.</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* Results Section */}
              <AnimatePresence>
                {resultado && !loading && (
                  <motion.section 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    className="bg-zinc-900 rounded-t-[40px] p-8 pb-12 shadow-2xl border-t border-white/10 -mt-10 z-10"
                  >
                    <div className="w-12 h-1.5 bg-zinc-700 rounded-full mx-auto mb-8" />
                    
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2">{resultado.nome}</h2>
                        <div className="flex items-center gap-2">
                          <span className="bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                            {resultado.objetivo_treino}
                          </span>
                          <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider">
                            IG: {resultado.indice_glicemico}
                          </span>
                        </div>
                      </div>
                      <div className="bg-pink-500/10 text-pink-500 px-4 py-2 rounded-2xl border border-pink-500/20 text-right">
                        <span className="text-2xl font-black block leading-none">{resultado.calorias}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">kcal</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-8">
                      <div className="bg-zinc-800/50 p-5 rounded-3xl border border-white/5">
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Proteína</h3>
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-black text-white">{resultado.proteinas}g</span>
                              <span className="text-sm font-bold text-pink-500">{proteinPerKg}g/kg</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black text-white">{proteinGoalPercentage}%</span>
                            <span className="text-[10px] block font-bold text-zinc-500 uppercase">Meta</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${proteinGoalPercentage}%` }}
                            className="h-full bg-pink-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-800/50 p-5 rounded-3xl border border-white/5">
                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Carbo</h3>
                          <span className="text-2xl font-black text-blue-400">{resultado.carboidratos}g</span>
                        </div>
                        <div className="bg-zinc-800/50 p-5 rounded-3xl border border-white/5">
                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Fibras</h3>
                          <span className="text-2xl font-black text-emerald-400">{resultado.fibras}g</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-pink-500/5 p-5 rounded-3xl border border-pink-500/10">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-pink-400 mb-1">Aminoácidos</h3>
                        <p className="text-zinc-300 text-sm">{resultado.aminoacidos}</p>
                      </div>
                      <div className="bg-blue-500/5 p-5 rounded-3xl border border-blue-500/10">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 mb-1">Dica AI</h3>
                        <p className="text-zinc-300 text-sm italic">"{resultado.dica_atleta}"</p>
                      </div>
                    </div>

                    <button 
                      onClick={reset}
                      className="w-full mt-8 py-5 bg-white text-black rounded-3xl font-black text-lg hover:bg-zinc-200 transition-all uppercase tracking-widest"
                    >
                      Novo Scan
                    </button>
                  </motion.section>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-6"
            >
              {!isPlus ? (
                <div className="bg-zinc-900 rounded-[40px] p-8 border border-white/10 text-center py-20">
                  <Crown className="w-16 h-16 text-pink-500 mx-auto mb-6" />
                  <h2 className="text-3xl font-black mb-4">Dashboard Plus</h2>
                  <p className="text-zinc-400 mb-8">Acompanhe seu déficit calórico e progresso detalhado com o plano PLUS.</p>
                  <button 
                    onClick={() => setShowPlanModal(true)}
                    className="px-8 py-4 bg-pink-500 text-white rounded-full font-black uppercase tracking-widest"
                  >
                    Ver Planos
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Calorias Hoje</h3>
                      <span className="text-3xl font-black text-white">
                        {scans.reduce((acc, s) => acc + s.calories, 0)}
                      </span>
                    </div>
                    <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Déficit</h3>
                      <span className="text-3xl font-black text-emerald-500">-450</span>
                    </div>
                  </div>

                  <div className="bg-zinc-900 p-6 rounded-[40px] border border-white/5 h-64">
                    <h3 className="text-sm font-black uppercase mb-6">Evolução Semanal</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={scans.slice(0, 7).reverse()}>
                        <defs>
                          <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis dataKey="created_at" hide />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '16px' }}
                          itemStyle={{ color: '#ec4899' }}
                        />
                        <Area type="monotone" dataKey="calories" stroke="#ec4899" fillOpacity={1} fill="url(#colorCal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase flex items-center gap-2">
                      <History className="w-4 h-4 text-pink-500" />
                      Histórico Recente
                    </h3>
                    {scans.map((scan, i) => (
                      <div key={i} className="bg-zinc-900 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                        <div>
                          <p className="font-bold">{scan.food_name}</p>
                          <p className="text-xs text-zinc-500">{new Date(scan.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-pink-500">{scan.calories} kcal</p>
                          <p className="text-[10px] text-zinc-500 uppercase">{scan.portion_size}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full p-4"
            >
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-3xl ${msg.sender === 'user' ? 'bg-pink-500 text-white rounded-tr-none' : 'bg-zinc-900 text-zinc-300 rounded-tl-none border border-white/5'}`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <span className="text-[10px] opacity-50 block mt-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 bg-zinc-900 p-2 rounded-full border border-white/10">
                <button className="p-3 text-zinc-500 hover:text-white transition-colors">
                  <Plus className="w-6 h-6" />
                </button>
                <input 
                  type="text" 
                  placeholder="Mensagem..."
                  className="flex-1 bg-transparent border-none outline-none text-sm px-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    const input = document.querySelector('input[placeholder="Mensagem..."]') as HTMLInputElement;
                    sendMessage(input.value);
                    input.value = '';
                  }}
                  className="p-3 bg-pink-500 rounded-full text-white shadow-lg shadow-pink-500/20"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'learn' && (
            <motion.div 
              key="learn"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-6"
            >
              <h2 className="text-3xl font-black mb-8">Aprenda</h2>
              {eduContent.map((item, i) => (
                <div key={i} className="bg-zinc-900 rounded-[32px] overflow-hidden border border-white/5">
                  <div className="h-40 bg-zinc-800 relative">
                    {item.image_url ? (
                      <img src={item.image_url} className="w-full h-full object-cover" alt={item.title} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}
                    <span className="absolute top-4 left-4 bg-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                      {item.category}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{item.content}</p>
                    <button className="mt-4 text-pink-500 text-xs font-black uppercase tracking-widest flex items-center gap-1">
                      Ler mais <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-8"
            >
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="w-24 h-24 bg-zinc-800 rounded-[32px] flex items-center justify-center border border-white/10 overflow-hidden">
                    {userProfile?.avatar ? (
                      <img src={userProfile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-12 h-12 text-zinc-600" />
                    )}
                  </div>
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 p-2 bg-pink-500 rounded-xl shadow-lg hover:scale-110 transition-transform"
                  >
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAvatarUpload} 
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-black">{userId}</h2>
                  <p className="text-zinc-500 text-sm">Membro desde {new Date(userProfile?.created_at || '').toLocaleDateString()}</p>
                  <span className="inline-block mt-2 bg-pink-500/10 text-pink-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-pink-500/20">
                    Plano {userProfile?.plan}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5">
                  <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Peso</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black">{userProfile?.weight}</span>
                    <span className="text-xs text-zinc-500 font-bold">kg</span>
                  </div>
                </div>
                <div className="bg-zinc-900 p-6 rounded-[32px] border border-white/5">
                  <p className="text-[10px] font-black text-zinc-500 uppercase mb-1">Altura</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black">{userProfile?.height || '--'}</span>
                    <span className="text-xs text-zinc-500 font-bold">cm</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setShowPlanModal(true)}
                  className="w-full p-6 bg-gradient-to-r from-pink-500 to-rose-500 rounded-[32px] flex items-center justify-between group shadow-xl shadow-pink-500/20"
                >
                  <div className="flex items-center gap-4">
                    <Crown className="w-8 h-8 text-white" />
                    <div className="text-left">
                      <p className="font-black text-lg">Gerenciar Assinatura</p>
                      <p className="text-white/70 text-xs">Veja seus benefícios e planos</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>

                <button 
                  onClick={() => {
                    localStorage.removeItem('nutriq_user_id');
                    window.location.reload();
                  }}
                  className="w-full p-6 bg-zinc-900 rounded-[32px] border border-white/5 text-red-500 font-black uppercase tracking-widest text-sm"
                >
                  Sair da Conta
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent pointer-events-none">
        <div className="max-w-md mx-auto bg-zinc-900/80 backdrop-blur-2xl rounded-[40px] p-2 border border-white/10 flex justify-between items-center pointer-events-auto shadow-2xl">
          {[
            { id: 'dashboard', icon: LayoutDashboard },
            { id: 'chat', icon: MessageCircle },
            { id: 'scanner', icon: Camera, primary: true },
            { id: 'learn', icon: BookOpen },
            { id: 'profile', icon: User },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative p-4 rounded-full transition-all ${
                tab.primary 
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/40 -mt-12 scale-110' 
                  : activeTab === tab.id ? 'text-pink-500' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <tab.icon className="w-6 h-6" />
              {activeTab === tab.id && !tab.primary && (
                <motion.div 
                  layoutId="nav-dot"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Plan Modal */}
      <AnimatePresence>
        {showPlanModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-xl flex items-end md:items-center justify-center p-6"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-zinc-900 w-full max-w-lg rounded-[40px] p-8 border border-white/10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white">Escolha seu Plano</h2>
                  <p className="text-zinc-400">Desbloqueie seu potencial máximo.</p>
                </div>
                <button onClick={() => setShowPlanModal(false)} className="p-2 bg-white/5 rounded-full">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Plan Start */}
                <div className={`p-6 rounded-[32px] border-2 transition-all ${userProfile?.plan === 'START' ? 'border-pink-500 bg-pink-500/5' : 'border-white/5 bg-zinc-800/50'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black">START</h3>
                    <span className="text-lg font-black text-pink-500">R$ 19,99<span className="text-xs text-zinc-500">/mês</span></span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {['Registro por foto', 'IA reconhece alimentos', 'Chat estilo Telegram', 'Comunidade'].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => updateProfile({ plan: 'START' })}
                    className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm"
                  >
                    Assinar Start
                  </button>
                </div>

                {/* Plan Plus */}
                <div className={`p-6 rounded-[32px] border-2 transition-all relative overflow-hidden ${userProfile?.plan === 'PLUS' ? 'border-pink-500 bg-pink-500/5' : 'border-pink-500/50 bg-pink-500/10'}`}>
                  <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl uppercase tracking-widest">
                    Recomendado
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black flex items-center gap-2">PLUS <Crown className="w-4 h-4" /></h3>
                    <span className="text-lg font-black text-pink-500">R$ 39,99<span className="text-xs text-zinc-500">/mês</span></span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {['TUDO LIBERADO', 'Déficit Calórico Automático', 'Dashboard de Progresso', 'Feedback Inteligente'].map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-zinc-100">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button 
                    onClick={() => updateProfile({ plan: 'PLUS' })}
                    className="w-full py-4 bg-pink-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-pink-500/20"
                  >
                    Assinar Plus
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[400] bg-black backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 w-full max-w-sm rounded-[40px] p-8 border border-white/10 text-center"
            >
              <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-pink-500/20">
                <Zap className="text-white w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black mb-2">Bem-vindo ao NutriQ</h2>
              <p className="text-zinc-400 text-sm mb-8">Identifique-se para salvar seu progresso e performance.</p>
              
              <input 
                type="text"
                placeholder="Seu Nome ou E-mail"
                className="w-full bg-zinc-800 border border-white/10 rounded-2xl py-4 px-6 mb-6 text-white focus:outline-none focus:border-pink-500 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLogin((e.target as HTMLInputElement).value);
                }}
                id="login-input"
              />

              <button 
                onClick={() => {
                  const val = (document.getElementById('login-input') as HTMLInputElement).value;
                  handleLogin(val);
                }}
                className="w-full py-5 bg-pink-500 text-white rounded-3xl font-black text-lg hover:bg-pink-600 transition-all active:scale-95 uppercase tracking-widest"
              >
                Acessar Meu Perfil
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-2xl z-50"
          >
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto font-bold text-xs uppercase tracking-widest opacity-80">Fechar</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden Canvas for Capture */}
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
      />
    </div>
  );
}
