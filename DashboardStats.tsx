import React from 'react';
import { PortfolioPage, PortfolioConfig } from '../types';
import { LucideIcon } from './LucideIcon';

import { PortfolioSection } from '../types';

interface DashboardStatsProps {
  pages: PortfolioPage[];
  sections: PortfolioSection[];
  config: PortfolioConfig;
  onSelectPage: (id: number) => void;
  onToggleControlPanel: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ 
  pages, 
  sections,
  config, 
  onSelectPage,
  onToggleControlPanel
}) => {
  // Compute metrics
  const totalCriteria = pages.reduce((acc, p) => acc + p.criteria.length, 0);
  const metCriteria = pages.reduce((acc, p) => acc + p.criteria.filter(c => c.isMet).length, 0);
  const completionPercent = totalCriteria > 0 ? Math.round((metCriteria / totalCriteria) * 100) : 0;

  const totalAttachments = pages.reduce((acc, p) => acc + p.attachments.length, 0);
  
  // Helper extractors for Vision, Mission, Values
  const getVisionText = () => {
    if (config.vision) return config.vision;
    if (config.biography) {
      const match = config.biography.match(/الرؤية:\s*([^.]+)/);
      if (match) return match[1].trim();
    }
    return "تعليم متميز لبناء مجتمع معرفي منافس عالمياً وفق رؤية المملكة 2030.";
  };

  const getMissionText = () => {
    if (config.mission) return config.mission;
    if (config.biography) {
      const match = config.biography.match(/الرسالة:\s*([^.]+)/);
      if (match) return match[1].trim();
    }
    return "تقديم خدمات تعليمية بجودة عالية وفق القيم الإسلامية والهوية الوطنية، لتمكين الطلاب من استكشاف المستقبل بمهارات وقدرات إبداعية.";
  };

  const getValuesList = (): string[] => {
    let valStr = config.values;
    if (!valStr && config.biography) {
      const match = config.biography.match(/القيم:\s*([^.]+)/);
      if (match) valStr = match[1].trim();
    }
    if (!valStr) {
      valStr = "المواطنة، الانتماء، العدالة، الشفافية، التميز، الإتقان";
    }
    return valStr
      .split(/[،,.]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  // Calculate category status: complete (all criteria met), in_progress (some met), not_started (none met or no criteria)
  const getPageStatus = (page: PortfolioPage) => {
    if (page.criteria.length === 0) return 'empty';
    const metCount = page.criteria.filter(c => c.isMet).length;
    if (metCount === page.criteria.length) return 'complete';
    if (metCount > 0) return 'in_progress';
    return 'not_started';
  };

  const statusCounts = pages.reduce(
    (acc, page) => {
      const status = getPageStatus(page);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { complete: 0, in_progress: 0, not_started: 0, empty: 0 }
  );

  return (
    <div className="space-y-6 dir-rtl" id="dashboard-stats-main">
      {/* Bio and Quick Info Banner - Inspired by Madrasati Saudi Ministry of Education */}
      <div className="bg-gradient-to-l from-madrasati-dark via-madrasati-teal to-madrasati-teal-light text-white rounded-3xl p-6 md:p-8 shadow-lg relative overflow-hidden">
        {/* Abstract design vector circles representing Ministry motif */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-2xl -ml-16 -mb-16"></div>
        
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-6 max-w-3xl w-full text-center md:text-right">
            {/* Principal Photo Card - Enlarged Frame */}
            <div className="relative shrink-0 select-none my-2">
              <div className="absolute -inset-2 bg-gradient-to-tr from-emerald-300 via-white to-teal-200 rounded-3xl blur-md opacity-80 animate-pulse"></div>
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 lg:w-52 lg:h-52 rounded-3xl overflow-hidden border-4 border-white bg-slate-50 shadow-2xl flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-[1.02]">
                {config.managerPhotoUrl ? (
                  <img 
                    src={config.managerPhotoUrl} 
                    alt={config.managerName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-teal-50 via-emerald-100 to-sky-100 flex flex-col items-center justify-center text-madrasati-teal p-4 text-center">
                    <LucideIcon name="User" size={56} className="text-madrasati-teal/80 mb-1" />
                    <span className="text-xs text-madrasati-teal-dark font-black tracking-tight leading-tight">صورة مدير المدرسة</span>
                    <span className="text-[9px] text-slate-500 font-bold mt-1">متاحة للرفع والتحميل</span>
                  </div>
                )}
              </div>
              
              {/* Floating ID indicator */}
              <div className="absolute -bottom-3 transform translate-x-1/2 right-1/2 bg-white text-slate-900 font-black text-xs py-1.5 px-4 rounded-full border-2 border-teal-500/30 shadow-lg whitespace-nowrap flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>{config.managerTitle}</span>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <h1 className="text-2xl md:text-3.5xl font-extrabold tracking-tight leading-snug">
                مرحباً بك في ملف إنجاز {config.managerTitle}
              </h1>
              
              <p className="text-teal-50/90 text-xs md:text-sm leading-relaxed font-medium">
                المنصة المعتمدة لتوثيق المعايير والحوكمة التعليمية بـ {config.schoolName}، ورصد المؤشرات والشواهد الرقمية بفاعلية وتكامل وفق معايير وزارة التعليم بالمملكة العربية السعودية.
              </p>

              <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-2 pt-2 text-[11px] text-teal-150 border-t border-white/10">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-white">المدرسة:</span> <span className="font-semibold text-white">{config.schoolName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-white">مدير المدرسة:</span> <span className="font-semibold text-white">{config.managerName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-white">العام الدراسي:</span> <span className="font-semibold text-white">{config.year}</span>
                </div>
                <div className="flex items-center gap-1 bg-white/15 px-2 py-0.5 rounded-md border border-white/20 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-bold text-white">قاعدة البيانات: متصلة سحابياً</span>
                </div>
              </div>
            </div>
          </div>

          {/* Circular Progress Widget in Gold/Teal */}
          <div className="flex flex-col items-center bg-white/10 p-5 rounded-2xl border border-white/20 backdrop-blur-md w-full md:w-auto min-w-[190px] shrink-0">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* SVG circular bar */}
              <svg className="absolute w-full h-full -rotate-90">
                <circle 
                  cx="56" 
                  cy="56" 
                  r="48" 
                  className="stroke-white/10 fill-none" 
                  strokeWidth="8"
                />
                <circle 
                  cx="56" 
                  cy="56" 
                  r="48" 
                  className="stroke-white fill-none transition-all duration-1000 ease-out" 
                  strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 48}`}
                  strokeDashoffset={`${2 * Math.PI * 48 * (1 - completionPercent / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center z-10">
                <span className="text-3xl font-black text-white">{completionPercent}%</span>
                <p className="text-[10px] text-teal-100 uppercase font-bold mt-0.5">مؤشر الإنجاز</p>
              </div>
            </div>
            <p className="text-[11px] text-teal-55 mt-3 text-center">
              استكمال <strong>{metCriteria}</strong> من <strong className="text-white">{totalCriteria}</strong> معياراً معتمداً
            </p>
          </div>
        </div>
      </div>

      {/* Vision, Mission, Values - 3 Separate Beautiful Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm md:text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-madrasati-teal block"></span>
            الرؤية والرسالة والقيم المؤسسية للمدرسة
          </h3>
          <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/80 hidden sm:inline-block">
            منظومة الحوكمة والتميز التربوي
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vision Card */}
          <div className="bg-gradient-to-br from-white via-teal-50/50 to-emerald-50/30 rounded-2xl p-5 border border-teal-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-teal-500 to-emerald-400"></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-100/90 text-teal-800 flex items-center justify-center font-bold shadow-3xs group-hover:scale-105 transition-transform shrink-0">
                    <LucideIcon name="Eye" size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">الرؤية</h4>
                    <p className="text-[10px] text-teal-700 font-extrabold">Vision 2030</p>
                  </div>
                </div>
                <span className="text-[10px] bg-teal-100/90 text-teal-900 font-black px-2.5 py-0.5 rounded-full border border-teal-200/80">
                  الهدف الاستراتيجي
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed font-bold pt-1">
                {getVisionText()}
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-teal-100/80 flex items-center justify-between text-[10px] text-teal-800 font-black">
              <span>المستهدفات المستقبلية</span>
              <LucideIcon name="Compass" size={14} className="text-teal-600" />
            </div>
          </div>

          {/* Mission Card */}
          <div className="bg-gradient-to-br from-white via-sky-50/50 to-blue-50/30 rounded-2xl p-5 border border-sky-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-sky-500 to-blue-500"></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-100/90 text-sky-800 flex items-center justify-center font-bold shadow-3xs group-hover:scale-105 transition-transform shrink-0">
                    <LucideIcon name="BookOpen" size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">الرسالة</h4>
                    <p className="text-[10px] text-sky-700 font-extrabold">Our Mission</p>
                  </div>
                </div>
                <span className="text-[10px] bg-sky-100/90 text-sky-900 font-black px-2.5 py-0.5 rounded-full border border-sky-200/80">
                  الواجب التعليمي
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed font-bold pt-1">
                {getMissionText()}
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-sky-100/80 flex items-center justify-between text-[10px] text-sky-800 font-black">
              <span>الخدمات والبيئة التعليمية</span>
              <LucideIcon name="Award" size={14} className="text-sky-600" />
            </div>
          </div>

          {/* Values Card */}
          <div className="bg-gradient-to-br from-white via-amber-50/50 to-yellow-50/30 rounded-2xl p-5 border border-amber-200/80 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-amber-500 to-yellow-400"></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100/90 text-amber-800 flex items-center justify-center font-bold shadow-3xs group-hover:scale-105 transition-transform shrink-0">
                    <LucideIcon name="Star" size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">القيم المؤسسية</h4>
                    <p className="text-[10px] text-amber-700 font-extrabold">Core Values</p>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-100/90 text-amber-900 font-black px-2.5 py-0.5 rounded-full border border-amber-200/80">
                  ثقافة التميز
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {getValuesList().map((val, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-200/90 text-amber-950 rounded-lg text-[11px] font-extrabold shadow-3xs hover:border-amber-300 transition-colors"
                  >
                    <LucideIcon name="Check" size={11} className="text-amber-600 shrink-0" />
                    <span>{val}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-amber-100/80 flex items-center justify-between text-[10px] text-amber-800 font-black">
              <span>السلوك التنظيمي والمعايير</span>
              <LucideIcon name="ShieldCheck" size={14} className="text-amber-600" />
            </div>
          </div>
        </div>
      </div>



      {/* Visual Map of the 19 Pages - Bento Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-madrasati-teal rounded-full"></span>
              خريطة معايير ملف إنجاز المدرسة
            </h3>
            <p className="text-xs text-slate-500">نظرة عامة على نسب الإنجاز وحالة الشواهد حسب الدليل الإجرائي المعياري</p>
          </div>
          <button 
            onClick={onToggleControlPanel}
            className="inline-flex items-center gap-2 px-4 py-2 border border-madrasati-teal/20 rounded-xl bg-madrasati-teal-bg text-madrasati-teal text-xs font-bold hover:bg-madrasati-teal/15 transition-colors cursor-pointer"
          >
            <LucideIcon name="Settings2" size={14} />
            فتح لوحة التحكم
          </button>
        </div>

        <div className="space-y-8 pt-2">
          {sections.map((sec) => {
            const sectionPages = pages.filter(p => (p.sectionId || 'school-admin') === sec.id);
            if (sectionPages.length === 0) return null;

            return (
              <div key={sec.id} className="space-y-3.5 border-t border-slate-100/80 pt-4 first:border-0 first:pt-0">
                <div className="flex items-center gap-2 justify-start bg-slate-50/80 py-1.5 px-3 rounded-lg border border-slate-200/40 w-fit">
                  <LucideIcon name="FolderOpen" size={14} className="text-madrasati-teal" />
                  <span className="font-black text-slate-800 text-xs">{sec.name}</span>
                  <span className="text-[10px] text-madrasati-teal bg-madrasati-teal-bg px-2 py-0.5 rounded-full font-bold">
                    {sectionPages.length} معايير ومؤشرات
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {sectionPages.map((p, idx) => {
                    const status = getPageStatus(p);
                    let statusBadge = "";
                    let statusStyle = "";
                    
                    if (status === 'complete') {
                      statusBadge = "مكتمل";
                      statusStyle = "border-emerald-250 bg-emerald-50/40 text-emerald-900 hover:bg-emerald-50 hover:border-emerald-300";
                    } else if (status === 'in_progress') {
                      statusBadge = "قيد العمل";
                      statusStyle = "border-slate-250 bg-slate-100/60 text-slate-800 hover:bg-slate-100 hover:border-slate-300";
                    } else {
                      statusBadge = "معايير فارغة";
                      statusStyle = "border-slate-200 bg-slate-50/70 text-slate-500 hover:bg-slate-100 hover:border-slate-300";
                    }

                    return (
                      <button
                        key={p.id}
                        onClick={() => onSelectPage(p.id)}
                        className={`flex flex-col text-right justify-between p-3.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${statusStyle}`}
                      >
                        <div className="flex items-start justify-between w-full mb-3">
                          <span className="text-[10px] text-madrasati-dark font-black bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                            {p.code ? `رمز: ${p.code}` : `رمز المعيار: إج-0${idx + 1}`}
                          </span>
                          <div className="w-7 h-7 rounded-lg bg-white/90 border border-slate-150 flex items-center justify-center text-madrasati-teal shadow-3xs shrink-0">
                            <LucideIcon name={p.iconName} size={14} />
                          </div>
                        </div>

                        <div className="space-y-1 w-full text-right">
                          <h4 className="font-extrabold text-slate-800 line-clamp-2 leading-tight min-h-[32px] text-slate-800">
                            {p.title}
                          </h4>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/30">
                            <span>{p.criteria.length} معايير</span>
                            <span className="font-bold">{statusBadge}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Advisory Banner - Madrasati Style Info */}
      <div className="bg-madrasati-teal-bg/60 p-5 rounded-2xl border border-madrasati-teal/15 flex items-start gap-4 text-right">
        <div className="w-10 h-10 rounded-full bg-white border border-madrasati-teal/10 flex items-center justify-center text-madrasati-teal shrink-0 shadow-3xs">
          <LucideIcon name="Info" size={18} />
        </div>
        <div className="space-y-1 text-xs">
  <h4 className="font-bold text-madrasati-dark text-xs">
    حوكمة الملف الإجرائي
  </h4>
  <p className="text-slate-650 leading-relaxed font-medium">
    نظام إلكتروني متكامل لمتابعة مؤشرات الأداء والبيانات.
  </p>
</div>
      </div>
    </div>
  );
};
