import React, { useState } from 'react';
import { Attachment } from '../types';
import { LucideIcon } from './LucideIcon';

interface AttachmentViewerModalProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  attachment,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  if (!attachment) return null;

  const isImage = 
    attachment.type === 'image' || 
    attachment.url?.startsWith('data:image/') || 
    /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(attachment.url || '');

  const isPdf = 
    attachment.url?.startsWith('data:application/pdf') || 
    /\.pdf(\?.*)?$/i.test(attachment.url || '');

  const isExternalUrl = 
    attachment.url && (attachment.url.startsWith('http://') || attachment.url.startsWith('https://'));

  const hasValidData = attachment.url && attachment.url !== '#' && attachment.url.length > 5;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs animate-fade-in text-right"
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-madrasati-teal text-white flex items-center justify-center shrink-0">
              <LucideIcon 
                name={isImage ? "Image" : isPdf ? "FileText" : isExternalUrl ? "Globe" : "Paperclip"} 
                size={16} 
              />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[260px] sm:max-w-md" title={attachment.name}>
                {attachment.name}
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                <span>{attachment.date}</span>
                {attachment.size && (
                  <>
                    <span>•</span>
                    <span>{attachment.size}</span>
                  </>
                )}
                <span>•</span>
                <span className="text-teal-400">
                  {isImage ? 'صورة إثبات' : isPdf ? 'ملف PDF' : isExternalUrl ? 'رابط خارجي' : 'مستند رسمي'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasValidData && (
              <a
                href={attachment.url}
                download={attachment.name || 'document'}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-madrasati-teal hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="تحميل أو فتح الشاهد في نافذة جديدة"
              >
                <LucideIcon name="Download" size={13} />
                <span className="hidden sm:inline">تحميل / فتح</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إغلاق"
            >
              <LucideIcon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Body Viewer */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4 min-h-[300px] max-h-[70vh]">
          {isImage && hasValidData ? (
            <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
              <img
                src={attachment.url}
                alt={attachment.name}
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
                className="rounded-lg shadow-md select-none"
              />
            </div>
          ) : isPdf && hasValidData ? (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center bg-white rounded-xl p-4 border border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <LucideIcon name="FileText" size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">{attachment.name}</h4>
                <p className="text-xs text-slate-500">مستند PDF رقمي جاهز للاطلاع والتحميل</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={attachment.url}
                  download={`${attachment.name}.pdf`}
                  className="px-4 py-2 bg-madrasati-teal text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <LucideIcon name="Download" size={14} />
                  <span>تنزيل ملف الـ PDF</span>
                </a>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center gap-1.5 border border-slate-200"
                >
                  <LucideIcon name="ExternalLink" size={14} />
                  <span>فتح في تبويب مستقل</span>
                </a>
              </div>
            </div>
          ) : isExternalUrl ? (
            <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-madrasati-teal flex items-center justify-center mx-auto">
                <LucideIcon name="Globe" size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">{attachment.name}</h4>
                <p className="text-xs text-slate-500 break-all dir-ltr font-mono">{attachment.url}</p>
              </div>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-madrasati-teal hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <LucideIcon name="ExternalLink" size={14} />
                <span>الانتقال إلى الرابط الخارجي</span>
              </a>
            </div>
          ) : (
            <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <LucideIcon name="FileCode" size={28} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-bold text-slate-900">{attachment.name}</h4>
                <p className="text-xs text-slate-500">
                  {hasValidData 
                    ? 'المستند متاح للتحميل مباشرة إلى جهازك.' 
                    : 'تم تسجيل هذا الشاهد المرجعي في الملف.'}
                </p>
                {attachment.size && (
                  <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md">
                    حجم الملف: {attachment.size}
                  </span>
                )}
              </div>
              {hasValidData && (
                <a
                  href={attachment.url}
                  download={attachment.name}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-madrasati-teal hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  <LucideIcon name="Download" size={14} />
                  <span>تنزيل الملف</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer toolbar for image viewing */}
        {isImage && hasValidData && (
          <div className="flex items-center justify-between px-5 py-2.5 bg-white border-t border-slate-200 shrink-0 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="تكبير"
              >
                <LucideIcon name="Plus" size={14} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="تصغير"
              >
                <LucideIcon name="Minus" size={14} />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                title="تدوير"
              >
                <LucideIcon name="RotateCw" size={14} />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                title="إعادة ضبط"
              >
                إعادة ضبط
              </button>
              <span className="text-[10px] text-slate-400 font-bold mr-2">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <div className="text-[10px] text-slate-400 font-medium">
              يمكنك النقر والتمرير للمعاينة
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
