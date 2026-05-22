import React, { useEffect, useState, Component, type ErrorInfo, type ReactNode } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

/** Fallback if Lottie/WebGL fails in some mobile WebViews (avoid blank screen) */
class SplashErrorBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_e: unknown, _info: ErrorInfo) {
    this.props.onFail();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete, duration = 2000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <SplashErrorBoundary onFail={onComplete}>
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="flex flex-col items-center gap-2">
          <DotLottieReact
            src="/3 ICON/marketpiepie.lottie"
            loop={true}
            autoplay={true}
            style={{ width: 150, height: 150 }}
          />
          <img
            src="/TEXT.svg"
            alt="piepie"
            className="h-10 w-auto object-contain"
          />
        </div>
      </div>
    </SplashErrorBoundary>
  );
};
