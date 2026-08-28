import React, { useState, useRef } from 'react';
import { PortfolioPage, Criterion, Attachment, AttachmentType } from '../types';
import { LucideIcon } from './LucideIcon';
import { processUploadedFile } from '../utils/imageUtils';

interface ControlPanelPageDetailsProps {
  page: PortfolioPage;
  onAddCriterion: (pageId: number, text: string) => void;
  onToggleCriterion: (pageId: number, criterionId: string) => void;
  onEditCriterionText: (pageId: number, criterionId: string, newText: string) => void;
  onDeleteCriterion: (pageId: number, criterionId: string) => void;
  onAddAttachment: (pageId: number, name: string, type: AttachmentType, url: string, size?: string) => void;
  onDeleteAttachment: (pageId: number, attachmentId: string) => void;
  onOpenAttachment?: (att: Attachment) => void;
}

export const ControlPanelPageDetails: React.FC<ControlPanelPageDetailsProps> = ({
  page,
  onAddCriterion,
  onToggleCriterion,
  onEditCriterionText,
  onDeleteCriterion,
  onAddAttachment,
  onDeleteAttachment,
  onOpenAttachment,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newCritText, setNewCritText] = useState('');
  
  // New attachment states
  const [attName, setAttName] = useState('');
  const [attType, setAttType] = useState<AttachmentType>('file');
  const [attUrl, setAttUrl] = useState('');
  const [attSize, setAttSize] = useState<string | undefined>(undefined);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for inline criterion editing
  const [editingCritId, setEditingCritId] = useState<string | null>(null);
  const [editingCritText, setEditingCritText] = useState('');

  const handleAddCritSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritText.trim()) return;
    onAddCriterion(page.id, newCritText.trim());
    setNewCritText('');
  };

  const handleAddAttSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attName.trim()) return;
    onAddAttachment(page.id, attName.trim(), attType, attUrl.trim() || '#', attSize);
    setAttName('');
    setAttUrl('');
    setAttSize(undefined);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      const file = files[0];
      const processed = await processUploadedFile(file);
      setAttName(processed.name);
      setAttType(processed.type);
      setAttUrl(processed.dataUrl);
      setAttSize(processed.sizeString);
    } catch (err) {
      console.error('Error reading file:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEditingCrit = (crit: Criterion) => {
    setEditingCritId(crit.id);
    setEditingCritText(crit.text);
  };

  const saveEditingCrit = (critId: string) => {
    if (!editingCritText.trim()) return;
    onEditCriterionText(page.id, critId, editingCritText.trim());
    setEditingCritId(null);
  };

  return (
    <div className="w-full bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden shadow-2xs">
      {/* Accordion Trigger Panel Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-100 hover:bg-slate-200/80 transition-colors text-xs font-bold text-slate-700 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <LucideIcon name={isOpen ? "ChevronLeft" : "ChevronRight"} size={13} className="text-slate-500 transform transition-transform" />
          <span className="text-madrasati-dark font-extrabold flex items-center gap-1">
            <LucideIcon name="Settings" size={12} className="text-madrasati-teal" />
            تعديل المعايير ({page.criteria.length}) والمرفقات ({page.attachments.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-madrasati-teal bg-white/90 px-2 py-0.5 rounded-full border border-slate-200/80 font-bold">
          <span>{page.criteria.filter(c => c.isMet).length}/{page.criteria.length} مكتمل</span>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 space-y-5 border-t border-slate-200/65 bg-white transition-all animate-fade-in text-slate-800 text-right">
          
          {/* Section 1: Page Criteria Management */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-black text-madrasati-dark flex items-center gap-1.5 border-b border-dashed border-slate-200 pb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-madrasati-teal"></span>
              إدارة معايير الصفحة
            </h5>

            {page.criteria.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-2 bg-slate-50 rounded-lg">
                لا توجد معايير مخصصة لهذه الصفحة حالياً. أضف معياراً بالأسفل.
              </p>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {page.criteria.map((crit) => (
                  <div
                    key={crit.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs justify-between ${
                      crit.isMet 
                        ? 'bg-emerald-50/50 border-emerald-100/80 text-emerald-950' 
                        : 'bg-slate-50 border-slate-150 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2 w-full">
                      {/* Checkbox to mark met/unmet */}
                      <button
                        type="button"
                        onClick={() => onToggleCriterion(page.id, crit.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${
                          crit.isMet
                            ? 'bg-madrasati-teal border-madrasati-teal text-white'
                            : 'bg-white border-slate-300 text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        {crit.isMet && <LucideIcon name="Check" size={10} />}
                      </button>

                      <div className="flex-1">
                        {editingCritId === crit.id ? (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              value={editingCritText}
                              onChange={(e) => setEditingCritText(e.target.value)}
                              className="w-full text-xs px-2 py-0.5 bg-white border border-madrasati-teal rounded focus:outline-none focus:ring-1 focus:ring-madrasati-teal"
                            />
                            <button
                              type="button"
                              onClick={() => saveEditingCrit(crit.id)}
                              className="p-1 bg-madrasati-teal text-white rounded hover:bg-madrasati-dark cursor-pointer text-[10px]"
                              title="حفظ"
                            >
                              <LucideIcon name="Check" size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCritId(null)}
                              className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 cursor-pointer text-[10px]"
                              title="إلغاء"
                            >
                              <LucideIcon name="X" size={11} />
                            </button>
                          </div>
                        ) : (
                          <span className={`${crit.isMet ? 'line-through text-slate-400 font-medium' : 'text-slate-800 font-bold'}`}>
                            {crit.text}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {editingCritId !== crit.id && (
                        <button
                          type="button"
                          onClick={() => startEditingCrit(crit)}
                          className="text-slate-400 hover:text-madrasati-teal p-0.5 hover:bg-slate-100 rounded cursor-pointer"
                          title="تعديل هذا المعيار"
                        >
                          <LucideIcon name="Edit3" size={11} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteCriterion(page.id, crit.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                        title="حذف هذا البند أو المعيار"
                      >
                        <LucideIcon name="Trash2" size={12} className="text-rose-500 hover:text-rose-700" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Form to add a quick criterion */}
            <form onSubmit={handleAddCritSubmit} className="flex gap-1.5">
              <input
                type="text"
                placeholder="أضف معياراً جديداً لهذا البند..."
                value={newCritText}
                onChange={(e) => setNewCritText(e.target.value)}
                className="flex-1 text-[11px] px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal"
              />
              <button
                type="submit"
                disabled={!newCritText.trim()}
                className="bg-madrasati-teal hover:bg-madrasati-dark text-white px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 shrink-0"
              >
                إضافة معيار
              </button>
            </form>
          </div>

          {/* Section 2: Page Evidence / Attachments Management */}
          <div className="space-y-3 pt-3 border-t border-slate-100 pb-1">
            <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-1.5">
              <h5 className="text-[11px] font-black text-madrasati-dark flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-madrasati-teal"></span>
                إدارة الشواهد والمرفقات
              </h5>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[10px] font-bold text-madrasati-teal hover:text-madrasati-dark bg-madrasati-teal-bg/60 border border-madrasati-teal/30 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer hover:bg-madrasati-teal-bg transition-colors"
              >
                <LucideIcon name="UploadCloud" size={11} />
                <span>{isUploading ? 'جارِ القراءة...' : 'رفع ملف / صورة من الجهاز'}</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFilePicked}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            />

            {page.attachments.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-2 bg-slate-50 rounded-lg">
                لا توجد شواهد أو وثائق مرفقة لهذه الصفحة حالياً. أضف شاهداً بالأسفل.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {page.attachments.map((att) => {
                  let badgeColor = "bg-madrasati-teal-bg text-madrasati-teal border-madrasati-teal/20";
                  let typeLabel = "ملف";
                  if (att.type === 'image') {
                    badgeColor = "bg-sky-50 text-sky-700 border-sky-100";
                    typeLabel = "شاهد مرئي";
                  } else if (att.type === 'drive') {
                    badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                    typeLabel = "جوجل درايف";
                  } else if (att.type === 'url') {
                    badgeColor = "bg-slate-100 text-slate-800 border-slate-200";
                    typeLabel = "رابط";
                  }

                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`text-[9px] font-bold border rounded px-1 shrink-0 ${badgeColor}`}>
                          {typeLabel}
                        </span>
                        <span className="text-slate-800 font-bold truncate max-w-[150px]" title={att.name}>
                          {att.name}
                        </span>
                        {att.size && (
                          <span className="text-[9px] text-slate-400 font-normal">({att.size})</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenAttachment) {
                              onOpenAttachment(att);
                            } else if (att.url && att.url !== '#') {
                              window.open(att.url, '_blank');
                            }
                          }}
                          className="text-slate-400 hover:text-madrasati-teal p-0.5 hover:bg-slate-100 rounded cursor-pointer"
                          title="فتح وعرض الشاهد"
                        >
                          <LucideIcon name="ExternalLink" size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteAttachment(page.id, att.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 hover:bg-slate-100 rounded cursor-pointer"
                          title="حذف هذا الشاهد"
                        >
                          <LucideIcon name="Trash2" size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Form to add an attachment */}
            <form onSubmit={handleAddAttSubmit} className="space-y-2 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/50">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500">اسم المرفق</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الخطة التشغيلية"
                    value={attName}
                    onChange={(e) => setAttName(e.target.value)}
                    className="w-full text-[10px] px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-madrasati-teal"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500">نوع الشاهد</label>
                  <select
                    value={attType}
                    onChange={(e) => setAttType(e.target.value as AttachmentType)}
                    className="w-full text-[10px] px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-madrasati-teal"
                  >
                    <option value="file">ملف رسمي (PDF / Word)</option>
                    <option value="image">صورة إثبات / وثيقة</option>
                    <option value="drive">مجلد Google Drive</option>
                    <option value="url">رابط خارجي</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-1.5 items-end">
                <div className="flex-1 space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500">
                    {attUrl && attUrl.startsWith('data:') ? 'تم تحميل بيانات الملف بنجاح' : 'رابط المستند السحابي أو الإلكتروني (اختياري)'}
                  </label>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/..."
                    value={attUrl && attUrl.startsWith('data:') ? `[ملف محلي مرفوع - ${attSize || 'جاهز'}]` : attUrl}
                    disabled={Boolean(attUrl && attUrl.startsWith('data:'))}
                    onChange={(e) => setAttUrl(e.target.value)}
                    className="w-full text-[10px] px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-madrasati-teal disabled:bg-slate-100 text-slate-600 font-sans"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!attName.trim() || isUploading}
                  className="bg-madrasati-teal hover:bg-madrasati-dark text-white px-3 py-1 text-[10px] font-bold rounded transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>

        </div>
      )}
    </div>
  );
};

