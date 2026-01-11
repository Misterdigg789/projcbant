import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  title: string;
  content: string;
  target: string;
  icon: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right';
  compact?: boolean;
}

interface OnboardingTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Bantah Events!',
    content: 'Challenge your friends in any real life events!',
    target: 'events-header',
    icon: <span className="text-lg">🎉</span>,
    position: 'bottom',
    compact: false
  },
  {
    id: 'create-event',
    title: 'Create Events & Earn Points',
    content: 'Get 1000 points instantly when you create your first event.',
    target: 'create',
    icon: <span className="text-lg">⚡</span>,
    position: 'top',
    compact: true
  },
  {
    id: 'community',
    title: 'Build Your Community',
    content: 'Your events attract participants who engage in real-time chat.',
    target: 'events-grid',
    icon: <span className="text-lg">👥</span>,
    position: 'top',
    compact: true
  },
  {
    id: 'rewards',
    title: 'Multiple Reward Streams',
    content: 'Earn from creator fees, achievements, and referrals.',
    target: 'events-header',
    icon: <span className="text-lg">🏆</span>,
    position: 'bottom',
    compact: true
  }
];

export function OnboardingTooltip({ isOpen, onClose, onComplete }: OnboardingTooltipProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = onboardingSteps[currentStep];

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      updatePosition();
      const handleResize = () => setTimeout(updatePosition, 100);
      const handleScroll = () => setTimeout(updatePosition, 50);
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    } else {
      setIsVisible(false);
    }
  }, [isOpen, currentStep]);

  const updatePosition = () => {
    if (!isOpen || !step) return;

    const tooltipWidth = step.compact ? 220 : 280;
    const tooltipHeight = step.compact ? 120 : 160;
    const padding = 16;
    const offset = 12;

    const targetElement = document.getElementById(step.target);
    if (!targetElement) {
      // Fallback to center if target not found
      setTooltipPosition({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001
      });
      setHighlightStyle({});
      setArrowStyle({});
      return;
    }

    const rect = targetElement.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    // Precise highlight around target
    setHighlightStyle({
      position: 'fixed',
      top: rect.top - 3,
      left: rect.left - 3,
      width: rect.width + 6,
      height: rect.height + 6,
      zIndex: 999,
      pointerEvents: 'none',
      borderRadius: '6px'
    });

    let style: React.CSSProperties = { position: 'fixed', zIndex: 1001 };
    let arrow: React.CSSProperties = { position: 'absolute', zIndex: 1002 };
    let top = 0, left = 0, transform = '';

    switch (step.position) {
      case 'top':
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2;
        transform = 'translateX(-50%)';
        arrow.top = tooltipHeight - 2;
        arrow.left = '50%';
        arrow.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2;
        transform = 'translateX(-50%)';
        arrow.top = -6;
        arrow.left = '50%';
        arrow.transform = 'translateX(-50%)';
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipWidth - offset;
        transform = 'translateY(-50%)';
        arrow.top = '50%';
        arrow.left = tooltipWidth - 2;
        arrow.transform = 'translateY(-50%)';
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + offset;
        transform = 'translateY(-50%)';
        arrow.top = '50%';
        arrow.left = -6;
        arrow.transform = 'translateY(-50%)';
        break;
    }

    // Adjust for viewport boundaries
    if (left < padding) { left = padding; transform = transform.replace('translateX(-50%)', ''); }
    else if (left + tooltipWidth > viewport.width - padding) {
      left = viewport.width - tooltipWidth - padding;
      transform = transform.replace('translateX(-50%)', '');
    }

    if (top < padding) { top = padding; if (transform.includes('translateY')) transform = transform.replace('translateY(-50%)', ''); }
    else if (top + tooltipHeight > viewport.height - padding) {
      top = viewport.height - tooltipHeight - padding;
      if (transform.includes('translateY')) transform = transform.replace('translateY(-50%)', '');
    }

    style.top = Math.max(padding, top);
    style.left = Math.max(padding, left);
    if (transform) style.transform = transform;

    setTooltipPosition(style);
    setArrowStyle(arrow);
  };

  const getArrowIcon = () => {
    switch (step.position) {
      case 'top': return <ChevronDown className="h-3 w-3 text-white drop-shadow-sm" />;
      case 'bottom': return <ChevronUp className="h-3 w-3 text-white drop-shadow-sm" />;
      case 'left': return <ChevronRight className="h-3 w-3 text-white drop-shadow-sm" />;
      case 'right': return <ChevronLeft className="h-3 w-3 text-white drop-shadow-sm" />;
      default: return null;
    }
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen || !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[998]">
      {/* Subtle overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={handleSkip} />

      {/* Precise highlight ring */}
      {highlightStyle.top !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={highlightStyle}
          className="rounded-lg"
        >
          <div className="absolute inset-0 rounded-lg bg-[#7440ff]/15 ring-2 ring-[#7440ff] ring-offset-1 ring-offset-transparent" />
        </motion.div>
      )}

      {/* Arrow pointing to target */}
      {arrowStyle.top !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          style={arrowStyle}
        >
          {getArrowIcon()}
        </motion.div>
      )}

      {/* Compact Tour Card */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={tooltipRef}
          key={currentStep}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={tooltipPosition}
          className={`bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${
            step.compact ? 'max-w-xs' : 'max-w-sm'
          }`}
        >
          {/* Progress bar */}
          <div className="h-0.5 bg-slate-200 dark:bg-slate-700">
            <motion.div
              className="h-full bg-gradient-to-r from-[#7440ff] to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className={`p-3 ${step.compact ? 'pb-2.5' : 'pb-3'}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {step.icon}
                </div>
                <h3 className={`font-semibold text-slate-900 dark:text-slate-100 leading-tight ${
                  step.compact ? 'text-sm' : 'text-base'
                }`}>
                  {step.title}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="h-6 w-6 p-0 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 dark:text-slate-400 flex-shrink-0 ml-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* Content */}
            <p className={`text-slate-600 dark:text-slate-400 mb-3 leading-snug ${
              step.compact ? 'text-xs' : 'text-sm'
            }`}>
              {step.content}
            </p>

            {/* Controls */}
            <div className="flex items-center justify-between">
              {/* Step indicators */}
              <div className="flex items-center gap-1">
                {onboardingSteps.map((_, index) => (
                  <motion.div
                    key={index}
                    initial={false}
                    animate={{
                      scale: index === currentStep ? 1.1 : 1,
                      opacity: index === currentStep ? 1 : 0.4
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`h-1.5 w-1.5 rounded-full ${
                      index <= currentStep
                        ? 'bg-[#7440ff]'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`} />
                  </motion.div>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className={`h-7 px-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    step.compact ? 'px-1.5' : 'px-2'
                  }`}
                >
                  Skip
                </Button>
                <Button
                  onClick={handleNext}
                  size="sm"
                  className={`h-7 px-3 text-xs font-medium bg-[#7440ff] hover:bg-[#6538e6] text-white ${
                    step.compact ? 'px-2' : 'px-3'
                  }`}
                >
                  {currentStep === onboardingSteps.length - 1 ? 'Done' : 'Next'}
                  {currentStep !== onboardingSteps.length - 1 && <ArrowRight className="h-3 w-3 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}