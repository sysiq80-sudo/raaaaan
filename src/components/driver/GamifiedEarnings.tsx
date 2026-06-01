/**
 * ران - شريط الأرباح اليومي المحفّز (Gamified Earnings Goal)
 * Features: XP-style progress bar, milestone badges, streak counter, celebration animations
 */

import { motion, AnimatePresence } from "framer-motion";
import { 
  Flame, 
  Trophy, 
  Star, 
  Zap, 
  TrendingUp,
  Target,
  Crown,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GamifiedEarningsProps {
  todayEarnings: number;
  todayRides: number;
  dailyGoal?: number;
  className?: string;
}

// نقاط المراحل (Milestones)
const MILESTONES = [
  { percent: 25, label: "بداية قوية", icon: Zap, color: "text-blue-400", bg: "bg-blue-500" },
  { percent: 50, label: "نصف الطريق", icon: Star, color: "text-amber-400", bg: "bg-amber-500" },
  { percent: 75, label: "شبه مكتمل", icon: Flame, color: "text-orange-400", bg: "bg-orange-500" },
  { percent: 100, label: "بطل اليوم!", icon: Trophy, color: "text-[#00E676]", bg: "bg-[#00E676]" },
];

const GamifiedEarnings = ({
  todayEarnings,
  todayRides,
  dailyGoal = 50000,
  className,
}: GamifiedEarningsProps) => {
  const progress = Math.min((todayEarnings / dailyGoal) * 100, 100);
  const remaining = Math.max(dailyGoal - todayEarnings, 0);
  const isGoalMet = todayEarnings >= dailyGoal;
  const isOverAchieved = todayEarnings > dailyGoal * 1.2; // 120%+

  // المرحلة الحالية
  const currentMilestone = MILESTONES.filter(m => progress >= m.percent).pop();
  const nextMilestone = MILESTONES.find(m => progress < m.percent);

  // XP Level calculation (each 10000 = 1 level)
  const level = Math.floor(todayEarnings / 10000) + 1;
  const xpInLevel = todayEarnings % 10000;
  const xpForNextLevel = 10000;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header: Level + Earnings */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Level Badge */}
          <motion.div
            key={level}
            initial={{ scale: 0.5, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
              "bg-gradient-to-br shadow-lg",
              isGoalMet 
                ? "from-[#00E676] to-[#00C853] text-black shadow-[#00E676]/30" 
                : "from-primary/20 to-primary/10 text-primary shadow-primary/10 border border-primary/20"
            )}
          >
            <span className="text-xs opacity-60">Lv</span>
            {level}
          </motion.div>

          <div>
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">هدف اليوم</span>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight">
              {todayEarnings.toLocaleString('en-US')}
              <span className="text-xs text-muted-foreground font-normal mr-1">
                / {dailyGoal.toLocaleString('en-US')} د.ع
              </span>
            </p>
          </div>
        </div>

        {/* Rides counter */}
        <div className="text-left">
          <div className="flex items-center gap-1 justify-end">
            <TrendingUp className="w-3.5 h-3.5 text-[#00E676]" />
            <span className="text-lg font-bold text-foreground">{todayRides}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">رحلة</span>
        </div>
      </div>

      {/* XP-Style Progress Bar */}
      <div className="relative">
        {/* Background Track */}
        <div className="h-5 rounded-full bg-secondary/60 border border-border/30 overflow-hidden relative">
          {/* Animated Fill */}
          <motion.div
            className={cn(
              "h-full rounded-full relative overflow-hidden",
              isGoalMet
                ? "bg-gradient-to-r from-[#00E676] to-[#69F0AE]"
                : "bg-gradient-to-r from-primary/80 to-primary"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
            />
            {/* Inner glow line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/30 rounded-full" />
          </motion.div>

          {/* Percentage text inside bar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              "text-[11px] font-bold",
              progress > 50 ? "text-white drop-shadow-sm" : "text-foreground"
            )}>
              {Math.round(progress)}%
            </span>
          </div>

          {/* Milestone markers on track */}
          {MILESTONES.map((milestone) => (
            <div
              key={milestone.percent}
              className="absolute top-0 bottom-0 flex items-center"
              style={{ right: `${milestone.percent}%`, transform: "translateX(50%)" }}
            >
              <div className={cn(
                "w-[3px] h-full transition-colors duration-300",
                progress >= milestone.percent ? "bg-white/40" : "bg-foreground/10"
              )} />
            </div>
          ))}
        </div>
      </div>

      {/* Milestone Badges */}
      <div className="flex items-center justify-between px-1">
        {MILESTONES.map((milestone) => {
          const achieved = progress >= milestone.percent;
          const MIcon = milestone.icon;
          return (
            <motion.div
              key={milestone.percent}
              className="flex flex-col items-center gap-0.5"
              animate={{
                scale: achieved ? 1 : 0.85,
                opacity: achieved ? 1 : 0.4,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300",
                achieved 
                  ? cn(milestone.bg, "shadow-md") 
                  : "bg-secondary/50 border border-border/30"
              )}>
                <MIcon className={cn(
                  "w-3.5 h-3.5",
                  achieved ? "text-white" : "text-muted-foreground/50"
                )} />
              </div>
              <span className={cn(
                "text-[9px] font-medium",
                achieved ? milestone.color : "text-muted-foreground/40"
              )}>
                {milestone.percent}%
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Status Message */}
      <AnimatePresence mode="wait">
        {isOverAchieved ? (
          <motion.div
            key="over"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#00E676]/15 to-amber-500/10 rounded-lg border border-[#00E676]/20"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">
              أداء استثنائي! تجاوزت الهدف 🎉
            </span>
          </motion.div>
        ) : isGoalMet ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-2 px-3 py-2 bg-[#00E676]/10 rounded-lg border border-[#00E676]/20"
          >
            <Sparkles className="w-4 h-4 text-[#00E676]" />
            <span className="text-xs font-bold text-[#00E676]">
              تم تحقيق الهدف اليومي! 🏆
            </span>
          </motion.div>
        ) : nextMilestone ? (
          <motion.div
            key="next"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center justify-between text-[11px] text-muted-foreground"
          >
            <span>
              متبقي: <span className="font-semibold text-foreground">{remaining.toLocaleString('en-US')}</span> د.ع
            </span>
            <span className="flex items-center gap-1">
              <nextMilestone.icon className={cn("w-3 h-3", nextMilestone.color)} />
              التالي: {nextMilestone.label}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default GamifiedEarnings;
