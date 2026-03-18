import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Camera, SwitchCamera, Loader2, AlertTriangle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasStream, setHasStream] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setHasStream(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      setLoading(true);
      setError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Ваш браузер или версия iOS не поддерживает доступ к камере напрямую. Попробуйте обновить iOS или используйте кнопку 'Галерея'.");
        setLoading(false);
        return;
      }

      try {
        // Stop previous stream before starting new one
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = newStream;
        setHasStream(true);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error("Camera access error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Доступ к камере запрещен. Разрешите доступ в настройках телефона.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError("Камера не найдена на этом устройстве.");
        } else {
          setError("Не удалось запустить камеру. Попробуйте кнопку 'Галерея'.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [facingMode, stopCamera]);

  const takePhoto = () => {
    if (!videoRef.current || !streamRef.current) return;

    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const maxDim = 1280;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (ctx) {
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, w, h);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
                onClose();
            }
        }, 'image/jpeg', 0.7);
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <button
            onClick={onClose}
            className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
        >
            <X size={24} />
        </button>
        <div className="text-white text-sm font-medium px-4 py-1 bg-black/30 rounded-full backdrop-blur-md border border-white/10">
            Фото чека
        </div>
        <button
            onClick={switchCamera}
            className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30"
        >
            <SwitchCamera size={24} />
        </button>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {loading && <Loader2 className="text-white animate-spin absolute" size={48} />}
        {error ? (
            <div className="text-white text-center p-6 max-w-xs mx-auto">
                <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={48} />
                <p className="mb-6 font-medium leading-relaxed">{error}</p>
                <button
                    onClick={onClose}
                    className="px-6 py-3 bg-white text-black font-bold rounded-xl active:scale-95 transition-transform"
                >
                    Закрыть и выбрать файл
                </button>
            </div>
        ) : (
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
            />
        )}
      </div>

      {/* Controls */}
      {!error && (
          <div className="h-32 bg-black flex items-center justify-center pb-6 pt-2">
             <button
                onClick={takePhoto}
                disabled={loading}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group active:scale-95 transition-transform"
             >
                <div className="w-16 h-16 bg-white rounded-full group-hover:scale-90 transition-transform"></div>
             </button>
          </div>
      )}
    </div>
  );
};
