import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCw, RotateCcw, CheckCircle, XCircle } from 'lucide-react';

interface CheckImageViewerProps {
  imageUrl: string;
  approvedAmount?: string;
  checkId?: string;
  checkStatus?: 'pending' | 'approved' | 'rejected';
  mpName?: string;
  month?: string;
  doctorName?: string;
  clientType?: string;
  onApprove?: () => void | Promise<void>;
  onReject?: (comment: string) => void | Promise<void>;
  onClose: () => void;
}

export const CheckImageViewer: React.FC<CheckImageViewerProps> = ({
  imageUrl,
  approvedAmount,
  checkId,
  checkStatus,
  mpName,
  month,
  doctorName,
  clientType,
  onApprove,
  onReject,
  onClose
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);

  const canAct = checkId && checkStatus === 'pending' && (onApprove || onReject);

  const handleApprove = async () => {
    if (onApprove) await onApprove();
  };

  const handleReject = async () => {
    if (onReject) {
      await onReject(rejectComment);
      setShowRejectForm(false);
      setRejectComment('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white bg-gradient-to-b from-black/70 to-black/30">
        <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">Просмотр чека</span>
            {approvedAmount && (
              <span className="text-sm font-medium text-emerald-400 bg-emerald-500/20 px-3 py-1 rounded-lg">
                Утверждённая сумма: {approvedAmount}
              </span>
            )}
            {clientType && (
              <span className="text-xs font-semibold text-amber-300 bg-amber-500/20 px-2 py-1 rounded-lg">
                {clientType}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-white/70">
            {mpName && <span><span className="text-white/50">МП:</span> <span className="text-white/90 font-medium">{mpName}</span></span>}
            {month && <span><span className="text-white/50">Месяц:</span> <span className="text-white/90 font-medium">{month}</span></span>}
            {doctorName && <span><span className="text-white/50">Врач:</span> <span className="text-white/90 font-medium">{doctorName}</span></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleRotateLeft}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            title="Повернуть влево"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={handleRotateRight}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            title="Повернуть вправо"
          >
            <RotateCw size={18} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center">
        <div
          className={`relative ${isFullscreen ? 'w-full h-full' : 'max-w-3xl max-h-[70vh]'}`}
        >
          <img
            src={imageUrl}
            alt="Чек"
            className="max-w-full max-h-full mx-auto select-none"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center'
            }}
          />
        </div>

        {canAct && (
          <div className="w-full max-w-3xl px-4 py-3 border-t border-white/10">
            {showRejectForm ? (
              <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-200">
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Причина отклонения..."
                  className="w-full p-3 text-sm bg-white/10 border border-red-300/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 text-white placeholder-white/50 resize-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectComment(''); }}
                    className="flex-1 py-2 text-xs font-semibold bg-white/10 text-white rounded-xl hover:bg-white/20"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleReject}
                    className="flex-1 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl flex items-center justify-center gap-1 hover:bg-red-600"
                  >
                    <XCircle size={14} />
                    Отклонить
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  className="flex-1 py-2.5 text-sm font-semibold bg-emerald-500 text-white rounded-xl flex items-center justify-center gap-1.5 hover:bg-emerald-600"
                >
                  <CheckCircle size={18} />
                  Принять
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 py-2.5 text-sm font-semibold bg-red-500 text-white rounded-xl flex items-center justify-center gap-1.5 hover:bg-red-600"
                >
                  <XCircle size={18} />
                  Отклонить
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

