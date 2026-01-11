import { Zap, Target, Users, Shield, Trophy, Coins, Star, MessageSquare, UserPlus, Award, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

// Import graphics
import chatGraphic from "../../bantah-graphics/photo_1_2025-12-31_11-18-44.jpg";
import communityGraphic from "../../bantah-graphics/photo_1_2025-12-31_11-21-19.jpg";
import chatIconGraphic from "../../bantah-graphics/photo_4_2025-12-31_11-18-44.jpg";
import largeCharacterGraphic from "../../bantah-graphics/photo_3_2025-12-31_11-18-44.jpg";
import friendsGraphic from "../../bantah-graphics/photo_5_2025-12-31_11-18-44.jpg";
import laptopChatGraphic from "../../bantah-graphics/photo_2_2025-12-31_11-18-44.jpg";
import bantzzbotLogo from "../../bantah-graphics/photo_8_2025-12-31_11-18-44.jpg";
import coinGraphic from "../../bantah-graphics/photo_10_2025-12-31_11-18-44.jpg";
import userAvatar1 from "../../bantah-graphics/photo_7_2025-12-31_11-18-44.jpg";
import userAvatar2 from "../../bantah-graphics/photo_9_2025-12-31_11-18-44.jpg";

export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 pb-20 font-sans selection:bg-primary selection:text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 relative">
        
        {/* Floating Background Assets */}
        <motion.div 
          animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-4 w-20 h-20 opacity-10 pointer-events-none hidden lg:block"
        >
          <img src={coinGraphic} alt="Coin" className="w-full h-auto" />
        </motion.div>
        
        <div className="space-y-16 md:space-y-24">
          {/* ==================== HERO SECTION ==================== */}
          <div className="flex flex-col gap-8">
            <div className="space-y-4 text-center md:text-left">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                Nigeria's #1 Prediction Hub
              </motion.div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9] uppercase">
                Bantah: <br />
                <span className="text-primary italic font-serif normal-case tracking-normal">Challenge your friends</span> earn daily!
              </h1>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-primary/5 flex flex-col justify-center items-center text-center">
                  <p className="text-2xl font-black text-primary">100%</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Escrow Backed</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-primary/5 flex flex-col justify-center items-center text-center">
                  <p className="text-2xl font-black text-primary">Instant</p>
                  <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Payouts</p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed font-medium text-center md:text-left">
                The ultimate destination for peer-to-peer challenges and social betting. From sports and crypto to everyday arguments, lock in your stakes and win.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="flex-1 rounded-xl h-12 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 transition-all active:scale-95" onClick={() => window.location.href = '/'}>Get Started</Button>
                <Button variant="outline" className="flex-1 rounded-xl h-12 font-black uppercase tracking-widest text-xs border-0 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all">How it works</Button>
              </div>
            </div>
          </div>

          {/* ==================== MODERN GRID LAYOUT ==================== */}
          <div className="grid grid-cols-1 gap-4">
            
            {/* 01 About Us Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-[2rem] flex flex-col justify-between group transition-all hover:scale-[1.01] shadow-xl shadow-indigo-500/10">
              <div className="flex justify-between items-start mb-4">
                <p className="text-6xl font-black text-white/20 leading-none">01</p>
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <ArrowUpRight className="text-white w-5 h-5" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Social Arguments</h3>
                <p className="text-xs text-white/80 font-medium leading-relaxed">Turn your opinions into profits by challenging friends on any topic imaginable.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AI Courses / Prediction Card */}
              <div className="bg-gradient-to-br from-[#7440FF] to-[#9D6BFF] p-8 rounded-[2rem] flex flex-col justify-between space-y-8 relative overflow-hidden group shadow-xl shadow-primary/10">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-2xl -mr-12 -mt-12"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl shadow-xl">
                    <p className="text-2xl font-black text-white">Escrow</p>
                    <p className="text-[8px] uppercase font-black text-white/80 tracking-widest">Guaranteed Safety</p>
                  </div>
                </div>
                <div className="space-y-4 relative z-10">
                  <h3 className="text-xl font-black leading-none uppercase tracking-tighter text-white">Verified Outcomes</h3>
                  <p className="text-xs text-white/90 font-medium leading-relaxed">AI and community-driven verification ensures every challenge is settled fairly.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['P2P Betting', 'Public Proof'].map(f => (
                      <Badge key={f} variant="outline" className="bg-white/10 border-0 rounded-full px-3 py-1 text-[8px] font-black uppercase tracking-widest text-white">{f}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature List Card */}
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-8 rounded-[2rem] space-y-6 shadow-xl shadow-orange-500/10 flex flex-col justify-center">
                <div className="space-y-3">
                  <div className="w-10 h-1 bg-white/50 rounded-full"></div>
                  <h3 className="text-xl font-black leading-none uppercase tracking-tighter text-white">Banter & P2P Matching</h3>
                  <p className="text-xs text-white/80 font-medium leading-relaxed">Engage in banter, match with opponents, and prove you're the champion.</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Live Chat', 'Leaderboards'].map(f => (
                    <Badge key={f} variant="outline" className="rounded-full border-0 bg-white/20 text-white py-1.5 px-3 text-[8px] font-black uppercase tracking-widest">{f}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats Visualization Card */}
            <div className="bg-slate-900 p-8 rounded-[2rem] relative overflow-hidden group shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="font-black uppercase tracking-widest text-[10px] text-white">Daily Winnings</h3>
                <Badge variant="secondary" className="rounded-full bg-white/10 text-white border-0 px-3 py-0.5 text-[8px] font-bold uppercase tracking-widest">LIVE STATS</Badge>
              </div>
              <div className="h-32 flex items-end gap-2 justify-between relative z-10">
                {[40, 60, 45, 90, 65, 30, 80, 55, 70].map((h, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.05, duration: 0.8 }}
                    className="flex-1 bg-primary rounded-t-lg hover:bg-white transition-colors cursor-pointer shadow-[0_0_10px_rgba(116,64,255,0.4)]" 
                  />
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                <span>MORNING</span>
                <span>NIGHT</span>
              </div>
            </div>

            {/* Social Connect Card */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 rounded-[2rem] flex flex-col gap-6 items-center group shadow-xl shadow-emerald-500/10">
              <div className="flex -space-x-4">
                {[userAvatar1, userAvatar2, communityGraphic, friendsGraphic].map((img, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -5, scale: 1.05 }}
                    className="w-12 h-12 rounded-xl border-[4px] border-white/30 bg-white/20 backdrop-blur-md overflow-hidden shadow-xl relative z-10 cursor-pointer"
                  >
                    <img src={img} alt="User" className="w-full h-full object-cover" />
                  </motion.div>
                ))}
                <div className="w-12 h-12 rounded-xl border-[4px] border-white/30 bg-white/20 backdrop-blur-md text-white flex items-center justify-center text-sm font-black shadow-xl relative z-0">+</div>
              </div>
              <p className="text-lg font-black leading-tight text-center uppercase tracking-tighter text-white">
                Join thousands <span className="text-white/70 italic font-serif normal-case tracking-normal">challenging each other</span> daily.
              </p>
            </div>

          </div>

          {/* ==================== WHY CHOOSE BANTAH ==================== */}
          <div className="text-center space-y-12">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-none">Why choose <br /><span className="text-primary italic font-serif normal-case tracking-normal">Bantah?</span></h2>
            <div className="grid grid-cols-1 gap-8 relative">
              <div className="flex items-center gap-6 group text-left px-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="shrink-0 w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20"
                >
                  <Award className="w-8 h-8" />
                </motion.div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black uppercase tracking-tight">Fair Payouts</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">No manual reviews or hidden delays. Instant rewards.</p>
                </div>
              </div>
              <div className="flex items-center gap-6 group text-left px-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="shrink-0 w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20"
                >
                  <Shield className="w-8 h-8" />
                </motion.div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black uppercase tracking-tight">Escrow Security</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Every stake is locked in escrow before a challenge starts.</p>
                </div>
              </div>
              <div className="flex items-center gap-6 group text-left px-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="shrink-0 w-16 h-16 bg-cyan-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20"
                >
                  <Users className="w-8 h-8" />
                </motion.div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black uppercase tracking-tight">Vibrant Community</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">From sports lovers to crypto degens, the banter is real.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ==================== BANTZZ BOT ==================== */}
          <div className="bg-primary text-white rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden group shadow-2xl shadow-primary/20">
            <div className="relative z-10 space-y-8">
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-black leading-[0.9] uppercase tracking-tighter">Meet <br /><span className="text-white/60 italic font-serif normal-case tracking-normal">Bantzz</span></h2>
                <p className="text-white/80 text-sm md:text-base font-medium leading-relaxed">
                  Bantzz is our official Telegram bot. Match with opponents and join the banter across Nigerian groups.
                </p>
                <a href="https://t.me/bantzzbot" target="_blank" rel="noopener noreferrer" className="inline-block w-full">
                  <Button className="w-full rounded-xl h-14 bg-white text-primary font-black uppercase tracking-widest text-lg hover:scale-[1.02] transition-all shadow-xl border-0">
                    Chat with Bantzz 🤖
                  </Button>
                </a>
              </div>
              <div className="relative pt-4">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-700 aspect-square max-w-[200px] mx-auto"
                >
                  <img src={bantzzbotLogo} alt="Bantzz" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                </motion.div>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-4 -right-4 w-16 h-16 bg-white rounded-full flex items-center justify-center p-1 shadow-2xl"
                >
                  <p className="text-primary font-black text-center text-[6px] leading-none uppercase tracking-widest">Verified • Bot • </p>
                </motion.div>
              </div>
            </div>
            
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -ml-32 -mt-32 animate-pulse"></div>
          </div>

          {/* ==================== TRUST & SECURITY ==================== */}
          <div className="space-y-12 py-8">
            <div className="space-y-6 text-center md:text-left">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-xl mx-auto md:mx-0">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[0.9]">Safe Escrow, <br />No <span className="text-primary italic font-serif normal-case tracking-normal">Stories</span></h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed text-sm md:text-base">
                Bulletproof escrow system. Stakes are locked immediately. No manual reviews, no favoritism. Winner takes the pool.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="px-4 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-primary/5">
                  <p className="text-xl font-black text-primary uppercase">Secure</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">P2P Escrow</p>
                </div>
                <div className="px-4 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-primary/5">
                  <p className="text-xl font-black text-primary uppercase">Fast</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Withdrawals</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
