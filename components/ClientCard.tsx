import React, { useState, useEffect } from 'react';
import { Client, UploadPayload } from '../types';
import { uploadCheck } from '../services/api';
import { compressImage } from '../utils/image';
import { isClientSentByStatus } from '../utils/status';
import { CameraCapture } from './CameraCapture';
import { Camera, Image as ImageIcon, UploadCloud, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  mpName: string;
  onUpdateStatus: (clientName: string) => void;
  hasLocalSent: boolean;
}

export const ClientCard: React.FC<ClientCardProps> = ({ client, mpName, onUpdateStatus, hasLocalSent }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  
  const isRejected = client.checkStatus === 'rejected';
  const isSent = (isClientSentByStatus(client.status) || !!client.checkStatus || hasLocalSent) && !isRejected;

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFile(file);
    }
    // Reset input value to allow re-selection
    e.target.value = '';
  };

  const handleCameraCapture = (file: File) => {
    setFile(file);
    setShowCamera(false);
  };

  const setFile = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const compressedData = await compressImage(selectedFile);
      
      const payload: UploadPayload = {
        action: 'upload',
        fileData: compressedData,
        clientData: {
          ...client,
          mpName
        }
      };

      const result = await uploadCheck(payload);
      
      if (result.success) {
        onUpdateStatus(client.client);
        clearFile();
      } else {
        alert(`Ошибка: ${result.error || 'Не удалось отправить'}`);
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка соединения. Проверьте интернет.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {showCamera && (
        <CameraCapture 
            onCapture={handleCameraCapture} 
            onClose={() => setShowCamera(false)} 
        />
      )}

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 transition-all duration-200 active:scale-[0.99]">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-slate-800 text-lg leading-tight flex-1 mr-2">{client.client}</h3>
          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-lg whitespace-nowrap">
            {client.type}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1 mb-4">
          <div className="flex items-center text-sm text-slate-500">
            <span className="font-medium mr-1">Спец:</span> {client.spec}
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-medium mr-1">АБ:</span> {client.ab}
          </div>
        </div>

        {/* Action Area */}
        <div className="border-t border-slate-100 pt-3">
          {/* Rejected check — show warning + comment + re-upload */}
          {isRejected && !selectedFile ? (
              <div className="flex flex-col gap-3">
                  <div className="bg-red-50 text-red-700 px-3 py-2 rounded-xl flex items-center justify-center text-sm font-semibold border border-red-100">
                      <AlertCircle size={18} className="mr-2" />
                      ЧЕК ОТКЛОНЁН
                  </div>
                  {client.checkComment && (
                    <div className="bg-red-50 text-red-700 px-3 py-2 rounded-xl text-xs border border-red-100 flex items-start gap-2">
                      <AlertCircle size={16} className="mt-[2px] flex-shrink-0" />
                      <div>
                        <span className="font-semibold block mb-0.5">Комментарий администратора:</span>
                        <span>{client.checkComment}</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 text-center">Загрузите новый чек ниже</p>
              </div>
          ) : null}

          {/* Sent/approved — green status */}
          {isSent && !selectedFile ? (
              <div className="flex flex-col gap-3">
                  <div className="bg-green-50 text-green-700 px-3 py-2 rounded-xl flex items-center justify-center text-sm font-semibold border border-green-100">
                      <CheckCircle size={18} className="mr-2" />
                      {client.checkStatus === 'approved' ? 'ЧЕК ПРИНЯТ' : 'ЧЕК ОТПРАВЛЕН'}
                  </div>
              </div>
          ) : null}

          {/* Upload Controls — show for unsent, rejected, or when file selected */}
          {(!isSent || isRejected || selectedFile) && (
            <div className="space-y-3">
              {/* Preview Area */}
              {selectedFile && previewUrl ? (
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400">Готов к отправке</p>
                  </div>
                  <button 
                    onClick={clearFile}
                    disabled={isUploading}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : null}

              {/* Buttons */}
              <div className="flex gap-2">
                {!selectedFile ? (
                  <>
                    {/* Gallery Input (Standard) */}
                    <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border-2 border-slate-200 text-slate-600 font-medium rounded-xl active:bg-slate-50 transition-colors cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange} 
                      />
                      <ImageIcon size={18} />
                      <span>Галерея</span>
                    </label>

                    {/* Camera Button (Custom Modal) */}
                    <button 
                      onClick={() => setShowCamera(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 text-white font-medium rounded-xl active:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                    >
                      <Camera size={18} />
                      <span>Камера</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold rounded-xl text-white shadow-lg transition-all ${
                      isUploading 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-brand hover:bg-brand-dark shadow-brand/30'
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Отправка...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={20} />
                        <span>ОТПРАВИТЬ ЧЕК</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};