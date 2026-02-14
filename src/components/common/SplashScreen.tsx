import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const SplashScreen = () => {
  // Rotating loading tips
  const loadingTips = [
    "جاري تجهيز الخريطة...",
    "نتأكد من أفضل المسارات لك...",
    "خدمة عراقية بكل فخر 🇮🇶",
    "ثواني ونكون جاهزين...",
  ];

  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % loadingTips.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-[#0a1f1c] to-black overflow-hidden dir-rtl">
      
      {/* 1. Artistic Background Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-green-500/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center space-y-8">
        
        {/* 2. Main Logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          <img 
            src="https://c.top4top.io/p_3697mxirb1.png" 
            alt="RAAN Logo" 
            className="w-40 md:w-48 h-auto object-contain drop-shadow-2xl"
          />
        </motion.div>

        {/* 3. The Animated Smile (SVG Path Animation) */}
        {/* Simulating the green curve under the RAAN logo */}
        <div className="relative w-32 h-12 flex items-center justify-center">
          <svg width="120" height="40" viewBox="0 0 120 40" className="overflow-visible">
            {/* Gray Background Path */}
            <path
              d="M 10 10 Q 60 50 110 10"
              fill="transparent"
              stroke="#374151" 
              strokeWidth="6"
              strokeLinecap="round"
            />
            
            {/* Animated Green Path */}
            <motion.path
              d="M 10 10 Q 60 50 110 10"
              fill="transparent"
              stroke="#00E676"
              strokeWidth="6"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ 
                pathLength: [0, 1, 0], 
                opacity: [0, 1, 0], 
                pathOffset: [0, 0, 1] 
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </svg>
        </div>

        {/* 4. 'Made in Iraq' Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-200 via-white to-emerald-200 tracking-wide font-kufi">
            ران RAAN
          </h2>
          
          <div className="flex items-center justify-center gap-2 px-4 py-1 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm">
            <span className="text-xs text-emerald-400 font-medium tracking-wider">
              صُنع في العراق
            </span>
            <span className="text-[10px] text-gray-400">Made in Iraq</span>
          </div>
        </motion.div>

        {/* 5. Dynamic Loading Tips */}
        <motion.p
          key={currentTip}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute bottom-[-60px] text-sm text-gray-400 font-light"
        >
          {loadingTips[currentTip]}
        </motion.p>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-8 text-[10px] text-gray-600 font-mono">
        © 2024 RAAN Technology
      </div>
    </div>
  );
};

export default SplashScreen;
