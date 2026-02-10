/**
 * AgentCreationOverlay
 *
 * Full-screen glassmorphic overlay shown during the 20-30s agent compilation.
 * Uses the ElevenLabs-style shader orb as a free-floating ambient visual,
 * with a thin linear progress bar, stage text transitions, stage indicator
 * dots, and confetti on completion.
 *
 * Design: The orb floats freely on the dark overlay without a circular frame
 * or progress ring, creating a premium atmospheric feel. Progress is shown
 * via a thin bar below the stage text.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, Mic, Zap, Rocket, CheckCircle2 } from "lucide-react";
import { Orb, type AgentState } from "@/components/ui/orb";
import { Confetti } from "@/components/ui/confetti";

export interface AgentCreationOverlayProps {
  isVisible: boolean;
  isComplete: boolean;
  onComplete?: () => void;
}

interface Stage {
  icon: typeof Brain;
  text: string;
  subtitle: string;
  targetProgress: number;
  duration: number;
  orbState: AgentState;
}

const STAGES: Stage[] = [
  {
    icon: Brain,
    text: "Analyzing your conversation",
    subtitle: "Understanding context & intent",
    targetProgress: 15,
    duration: 4000,
    orbState: null,
  },
  {
    icon: Sparkles,
    text: "Crafting personality & tone",
    subtitle: "Building unique voice character",
    targetProgress: 35,
    duration: 5000,
    orbState: null,
  },
  {
    icon: Mic,
    text: "Configuring voice settings",
    subtitle: "Optimizing speech parameters",
    targetProgress: 55,
    duration: 5000,
    orbState: null,
  },
  {
    icon: Zap,
    text: "Compiling your agent",
    subtitle: "Assembling all components",
    targetProgress: 80,
    duration: 8000,
    orbState: null,
  },
  {
    icon: Rocket,
    text: "Almost ready",
    subtitle: "Final optimizations",
    targetProgress: 92,
    duration: 20000,
    orbState: null,
  },
];

const COMPLETE_STAGE = {
  icon: CheckCircle2,
  text: "Your agent is ready!",
  subtitle: "Let's meet your new voice agent",
  targetProgress: 100,
};

const ORB_COLORS: [string, string] = ["#0D2D5A", "#2A5A8F"];
const ORB_COMPLETE_COLORS: [string, string] = ["#166534", "#4ade80"];

// Orb canvas size — the shader orb renders at ~91.2% of container
const ORB_SIZE = 280;
// Progress bar dimensions
const BAR_WIDTH = 220;

// -- Framer Motion variants --

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.6, ease: "easeIn", delay: 0.1 },
  },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 24,
      mass: 1,
      delay: 0.15,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -15,
    transition: { duration: 0.4, ease: "easeIn" },
  },
};

const textVariants = {
  initial: { opacity: 0, y: 12, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: "blur(4px)",
    transition: { duration: 0.25, ease: "easeIn" },
  },
};

const completePulseVariants = {
  idle: { scale: 1 },
  pulse: {
    scale: [1, 1.06, 1],
    transition: { duration: 0.7, ease: "easeInOut" },
  },
};

export function AgentCreationOverlay({
  isVisible,
  isComplete,
  onComplete,
}: AgentCreationOverlayProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completePulse, setCompletePulse] = useState(false);
  const rafRef = useRef<number>(0);
  const stageStartRef = useRef(0);
  const prevProgressRef = useRef(0);

  // Reset state when overlay appears
  useEffect(() => {
    if (isVisible) {
      setStageIndex(0);
      setProgress(0);
      setShowConfetti(false);
      setCompletePulse(false);
      stageStartRef.current = performance.now();
      prevProgressRef.current = 0;
    }
  }, [isVisible]);

  // Stage timer - auto-advance through stages
  useEffect(() => {
    if (!isVisible || isComplete) return;

    const stage = STAGES[stageIndex];
    if (!stage || stageIndex >= STAGES.length - 1) return;

    const timer = setTimeout(() => {
      setStageIndex(i => i + 1);
      stageStartRef.current = performance.now();
      prevProgressRef.current = stage.targetProgress;
    }, stage.duration);

    return () => clearTimeout(timer);
  }, [isVisible, isComplete, stageIndex]);

  // Smooth progress via requestAnimationFrame
  useEffect(() => {
    if (!isVisible) return;

    const animate = () => {
      if (isComplete) {
        setProgress(100);
        return;
      }

      const stage = STAGES[stageIndex];
      if (!stage) return;

      const elapsed = performance.now() - stageStartRef.current;
      const t = Math.min(elapsed / stage.duration, 1);

      // Last stage slows asymptotically; others use cubic ease-out
      const eased =
        stageIndex === STAGES.length - 1 ? t * t * (3 - 2 * t) * 0.6 : 1 - Math.pow(1 - t, 3);

      const from = prevProgressRef.current;
      const to = stage.targetProgress;
      setProgress(Math.min(from + (to - from) * eased, 92));
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isVisible, isComplete, stageIndex]);

  // Completion sequence: pulse -> confetti -> callback
  useEffect(() => {
    if (!isComplete || !isVisible) return;

    setProgress(100);
    setCompletePulse(true);

    const confettiDelay = setTimeout(() => setShowConfetti(true), 400);
    const completeDelay = setTimeout(() => onComplete?.(), 2800);

    return () => {
      clearTimeout(confettiDelay);
      clearTimeout(completeDelay);
    };
  }, [isComplete, isVisible, onComplete]);

  const currentStage = isComplete ? COMPLETE_STAGE : (STAGES[stageIndex] ?? STAGES[0]);
  const StageIcon = currentStage.icon;
  const orbState: AgentState = isComplete ? null : (STAGES[stageIndex]?.orbState ?? null);
  const orbColors = isComplete ? ORB_COMPLETE_COLORS : ORB_COLORS;
  const progressPct = progress / 100;

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="forge-overlay-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0F1A]/95 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Creating your agent"
        >
          {/* Content container */}
          <motion.div
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col items-center gap-8"
          >
            {/* Orb — free-floating, no disc or ring */}
            <motion.div
              variants={completePulseVariants}
              animate={completePulse ? "pulse" : "idle"}
              className="relative"
              style={{ width: ORB_SIZE, height: ORB_SIZE }}
            >
              {/* Ambient glow behind orb */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  transform: "scale(1.4)",
                  background: isComplete
                    ? "radial-gradient(circle, rgba(74, 222, 128, 0.12) 0%, rgba(74, 222, 128, 0.03) 45%, transparent 70%)"
                    : "radial-gradient(circle, rgba(42, 90, 143, 0.15) 0%, rgba(13, 45, 90, 0.06) 45%, transparent 70%)",
                  transition: "background 0.6s ease",
                }}
              />

              {/* Completion glow burst */}
              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1.6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(74, 222, 128, 0.20) 0%, rgba(74, 222, 128, 0.06) 50%, transparent 75%)",
                    }}
                  />
                )}
              </AnimatePresence>

              {/* The Orb itself */}
              <Orb agentState={orbState} colors={orbColors} seed={42} />
            </motion.div>

            {/* Stage text + progress bar + dots */}
            <div className="flex flex-col items-center gap-4 min-h-[110px]">
              {/* Stage text */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={isComplete ? "done" : stageIndex}
                  variants={textVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="flex items-center gap-2.5">
                    <StageIcon
                      className={`w-5 h-5 ${isComplete ? "text-green-400" : "text-[#99CDFF]"}`}
                    />
                    <p
                      className={`text-lg font-semibold tracking-tight ${
                        isComplete ? "text-green-400" : "text-white/90"
                      }`}
                    >
                      {currentStage.text}
                    </p>
                  </div>
                  <p className="text-sm text-white/35">{currentStage.subtitle}</p>
                </motion.div>
              </AnimatePresence>

              {/* Linear progress bar */}
              <div
                className="relative rounded-full overflow-hidden"
                style={{
                  width: BAR_WIDTH,
                  height: 3,
                  backgroundColor: isComplete
                    ? "rgba(74, 222, 128, 0.10)"
                    : "hsl(var(--primary) / 0.08)",
                  transition: "background-color 0.4s ease",
                }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  animate={{
                    width: `${progress}%`,
                    backgroundColor: isComplete ? "#4ade80" : "#99CDFF",
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{
                    boxShadow: isComplete
                      ? "0 0 12px rgba(74, 222, 128, 0.5)"
                      : "0 0 8px hsl(var(--primary) / 0.3)",
                  }}
                />
              </div>

              {/* Stage dots + percentage row */}
              <div className="flex items-center gap-4">
                {/* Stage indicator dots */}
                <div className="flex items-center gap-1.5">
                  {STAGES.map((_, i) => (
                    <motion.div
                      key={i}
                      className="rounded-full"
                      animate={{
                        width: isComplete || i <= stageIndex ? 6 : 4,
                        height: isComplete || i <= stageIndex ? 6 : 4,
                        backgroundColor: isComplete
                          ? "#4ade80"
                          : i <= stageIndex
                            ? "#99CDFF"
                            : "rgba(255, 255, 255, 0.12)",
                        opacity: isComplete || i <= stageIndex ? 1 : 0.5,
                      }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  ))}
                </div>

                {/* Separator */}
                <div className="w-px h-3 bg-white/10" />

                {/* Progress percentage */}
                <motion.p
                  className="text-xs tabular-nums font-mono"
                  animate={{
                    color: isComplete
                      ? "rgba(74, 222, 128, 0.7)"
                      : `hsl(var(--primary) / ${0.25 + progressPct * 0.35})`,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {Math.round(progress)}%
                </motion.p>
              </div>
            </div>
          </motion.div>

          {/* Confetti */}
          <Confetti
            active={showConfetti}
            count={100}
            duration={2500}
            colors={["#99CDFF", "#4ade80", "#facc15", "#f472b6", "#a78bfa"]}
            onComplete={handleConfettiComplete}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
