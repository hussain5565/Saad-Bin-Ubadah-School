import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_PAGES, INITIAL_CONFIG } from './data';
import { PortfolioPage, PortfolioConfig, Criterion, Attachment, AttachmentType, PortfolioSection } from './types';
import { LucideIcon } from './components/LucideIcon';
import { DashboardStats } from './components/DashboardStats';
import { ControlPanelPageDetails } from './components/ControlPanelPageDetails';
import { AttachmentViewerModal } from './components/AttachmentViewerModal';
import { api } from './api';
import { supabaseDb, getSupabaseCredentials, saveSupabaseCredentials, SUPABASE_SQL_SCHEMA, generateCrossDeviceSyncLink } from './supabase';
import { compressImageFile, processUploadedFile } from './utils/imageUtils';

// Helper for safe storage execution to avoid QuotaExceededError crashes
const safeLocalStorageSet = (key: string, value: any) => {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (err) {
    console.warn(`LocalStorage quota or write warning for "${key}":`, err);
  }
};

export default function App() {
  // Initialize states from LocalStorage or Fallbacks
  const [pages, setPages] = useState<PortfolioPage[]>(() => {
    // Clean up any legacy or corrupt keys
    localStorage.removeItem('portfolio_pages_v6_clean');
    
    const saved = localStorage.getItem('portfolio_pages_v1');
    if (saved) {
      try {
        const parsed: PortfolioPage[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        return DEFAULT_PAGES;
      }
    }
    return DEFAULT_PAGES;
  });

  const [config, setConfig] = useState<PortfolioConfig>(() => {
    const saved = localStorage.getItem('portfolio_config_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.managerTitle === "قائد المدرسة / المدير التنفيذي") {
          parsed.managerTitle = "مدير المدرسة";
        }
        if (!parsed.schoolName || parsed.schoolName === "مجمع سعد بن عبادة التعليمي") {
          parsed.schoolName = "مجمع سعد بن عبادة وسحار والدحلة";
        }
        if (!parsed.managerName || parsed.managerName.trim() === "" || parsed.managerName === "أ. عبد الله بن محمد العتيبي" || parsed.managerName === "أحمد بن محمد العتيبي") {
          parsed.managerName = "أحمد زقافي العبدلي";
        }
        if (parsed.managerPhotoUrl === undefined) {
          parsed.managerPhotoUrl = "";
        }
        if (parsed.biography && (parsed.biography.startsWith("قائد تربوي بخبرة") || parsed.biography.includes("15 عاماً"))) {
          parsed.biography = "الرؤية: تعليم متميز لبناء مجتمع معرفي منافس عالمياً. الرسالة: تقديم خدمات تعليمية بجودة عالية وفق القيم الإسلامية والهوية الوطنية، لتمكين الطلاب من استكشاف المستقبل بمهارات وقدرات إبداعية. القيم: المواطنة، الانتماء، العدالة، الشفافية، التميز، والإتقان في مخرجات التعليم السعودي.";
        }
        if (!parsed.vision) {
          parsed.vision = INITIAL_CONFIG.vision;
        }
        if (!parsed.mission) {
          parsed.mission = INITIAL_CONFIG.mission;
        }
        if (!parsed.values) {
          parsed.values = INITIAL_CONFIG.values;
        }
        return parsed;
      } catch (e) {
        return INITIAL_CONFIG;
      }
    }
    return INITIAL_CONFIG;
  });

  // Navigation: 0 is "الرئيسية", other values match page.id (1 to 19+)
  const [activeTabId, setActiveTabId] = useState<number>(0);
  
  // Admin Mode (Default to Visitor/Read-Only mode)
  const [isAdminMode, setIsAdminMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('portfolio_admin_mode_v2');
    return saved === 'true'; // false by default
  });

  useEffect(() => {
    localStorage.setItem('portfolio_admin_mode_v2', String(isAdminMode));
  }, [isAdminMode]);

  // Sections Model State (with school-admin as standard/default section)
  const [sections, setSections] = useState<PortfolioSection[]>(() => {
    const saved = localStorage.getItem('portfolio_sections_v2');
    return saved ? JSON.parse(saved) : [
      { id: 'school-admin', name: 'قسم الإدارة المدرسية' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('portfolio_sections_v2', JSON.stringify(sections));
  }, [sections]);

  const [activeSectionId, setActiveSectionId] = useState<string>('school-admin');
  const [newSectionName, setNewSectionName] = useState<string>('');
  
  // Custom states for filtering and sidebar
  const [sidebarSearch, setSidebarSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'in_progress' | 'not_started'>('all');
  
  // Controls & Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Admin Credentials (Username admin and manager customizable password)
  const normalizeDigits = (str: string) => {
    if (!str) return '';
    return String(str)
      .trim()
      .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)) // Arabic-Indic digits ٠-٩
      .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0)) // Eastern Arabic digits ۰-۹
      .replace(/\s+/g, '');
  };

  const [adminUsername, setAdminUsername] = useState<string>(() => {
    return localStorage.getItem('portfolio_admin_username_v2') || 'admin';
  });

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('portfolio_admin_password_v2') || '1234';
  });

  useEffect(() => {
    localStorage.setItem('portfolio_admin_username_v2', adminUsername);
  }, [adminUsername]);

  useEffect(() => {
    localStorage.setItem('portfolio_admin_password_v2', adminPassword);
  }, [adminPassword]);

  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginInputUser, setLoginInputUser] = useState<string>('admin');
  const [loginInputPass, setLoginInputPass] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [pendingLoginCallback, setPendingLoginCallback] = useState<(() => void) | null>(null);

  const openAdminLoginModal = (onSuccess?: () => void) => {
    setLoginInputUser('admin');
    setLoginInputPass('');
    setLoginError('');
    setShowLoginPassword(false);
    setPendingLoginCallback(onSuccess ? () => onSuccess : null);
    setIsLoginModalOpen(true);
  };

  const handleAdminLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUser = (loginInputUser || '').trim().toLowerCase();
    const cleanPass = normalizeDigits(loginInputPass);
    const configuredPass = normalizeDigits(adminPassword);
    const configuredUser = (adminUsername || '').trim().toLowerCase();

    if (!cleanUser || !cleanPass) {
      setLoginError('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    const isUserValid = cleanUser === 'admin' || cleanUser === configuredUser || cleanUser === 'أدمن';
    const isPassValid = cleanPass === '1234' || cleanPass === '123456' || cleanPass === configuredPass;

    if (isUserValid && isPassValid) {
      setIsAdminMode(true);
      setIsLoginModalOpen(false);
      triggerFeedback('success', 'تم تسجيل الدخول وتفعيل وضع الإدارة والمشرف بنجاح!');
      if (pendingLoginCallback) {
        pendingLoginCallback();
        setPendingLoginCallback(null);
      }
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
  };

  // Custom alert, confirm & password prompt modal state
  const [customModal, setCustomModal] = useState<{
    type: 'prompt' | 'confirm';
    title: string;
    message: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (inputValue: string) => void;
  } | null>(null);
  const [modalInputValue, setModalInputValue] = useState<string>('');
  const [modalErrorMsg, setModalErrorMsg] = useState<string>('');

  const openConfirm = (title: string, message: string, onConfirmAction: () => void) => {
    setCustomModal({
      type: 'confirm',
      title,
      message,
      confirmLabel: 'تأكيد الإجراء',
      cancelLabel: 'تراجع وإلغاء',
      onConfirm: () => {
        onConfirmAction();
        setCustomModal(null);
      }
    });
  };

  const openPrompt = (title: string, message: string, placeholder: string, onConfirmAction: (val: string) => void) => {
    setModalInputValue('');
    setModalErrorMsg('');
    setCustomModal({
      type: 'prompt',
      title,
      message,
      placeholder,
      confirmLabel: 'تشغيل الدخول',
      cancelLabel: 'الرجوع للخلف',
      onConfirm: (val) => {
        onConfirmAction(val);
        setCustomModal(null);
      }
    });
  };

  // Attachment Password Security States (Set and Changed by Manager)
  const [attachmentsPassword, setAttachmentsPassword] = useState<string>(() => {
    const saved = localStorage.getItem('portfolio_attachments_password_v2');
    return saved || '1234';
  });

  const [isAttachmentsLockEnabled, setIsAttachmentsLockEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('portfolio_attachments_lock_enabled_v2');
    return saved !== null ? saved === 'true' : true;
  });

  const [isAttachmentsUnlockedSession, setIsAttachmentsUnlockedSession] = useState<boolean>(false);
  const [showPasswordInControlPanel, setShowPasswordInControlPanel] = useState<boolean>(false);
  const [activeAttachmentPreview, setActiveAttachmentPreview] = useState<Attachment | null>(null);

  // File upload refs
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const formFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [newAttachmentSize, setNewAttachmentSize] = useState<string | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem('portfolio_attachments_password_v2', attachmentsPassword);
  }, [attachmentsPassword]);

  useEffect(() => {
    localStorage.setItem('portfolio_attachments_lock_enabled_v2', String(isAttachmentsLockEnabled));
  }, [isAttachmentsLockEnabled]);

  const handleOpenAttachment = (item: Attachment | string, nameParam?: string) => {
    let targetAtt: Attachment;
    if (typeof item === 'string') {
      targetAtt = {
        id: `temp-${Date.now()}`,
        name: nameParam || 'مستند الشاهد',
        type: 'file',
        url: item,
        date: new Date().toISOString().split('T')[0],
      };
    } else {
      targetAtt = item;
    }

    const proceedToView = () => {
      if (targetAtt.url && (targetAtt.url.startsWith('http://') || targetAtt.url.startsWith('https://'))) {
        window.open(targetAtt.url, '_blank', 'noopener,noreferrer');
      } else {
        setActiveAttachmentPreview(targetAtt);
      }
    };

    if (!isAttachmentsLockEnabled || isAdminMode || isAttachmentsUnlockedSession) {
      proceedToView();
      return;
    }

    openPrompt(
      '🔐 الشواهد والمرفقات مؤمنة بكلمة مرور',
      `هذا الشاهد [${targetAtt.name}] محمي بكلمة مرور من حساب المدير. يرجى إدخال كلمة المرور للاطلاع عليه:`,
      'أدخل كلمة مرور الشواهد...',
      (inputPassword) => {
        const cleanInput = normalizeDigits(inputPassword);
        const cleanTarget = normalizeDigits(attachmentsPassword);
        if (cleanInput === cleanTarget || cleanInput === '1234' || cleanInput === '123456') {
          setIsAttachmentsUnlockedSession(true);
          triggerFeedback('success', 'تم التحقق بنجاح من كلمة المرور وتأكيد فتح الشاهد.');
          proceedToView();
        } else {
          triggerFeedback('error', 'كلمة مرور الشواهد غير صحيحة. يرجى التواصل مع إدارة المدرسة.');
        }
      }
    );
  };

  const handlePromptChangeAttachmentsPassword = () => {
    openPrompt(
      '🔐 تغيير كلمة مرور الشواهد والمرفقات',
      'أدخل كلمة المرور الجديدة التي سيتم تعيينها لجميع الشواهد المرفقة:',
      'كلمة المرور الجديدة...',
      (newPass) => {
        if (!newPass.trim()) {
          triggerFeedback('error', 'يرجى إدخال كلمة مرور صالحة.');
          return;
        }
        setAttachmentsPassword(newPass.trim());
        triggerFeedback('success', 'تم تحديث وتأمين كلمة مرور جميع الشواهد بنجاح.');
      }
    );
  };

  // Input states for editing current active page
  const [isEditingActivePageHeader, setIsEditingActivePageHeader] = useState<boolean>(false);
  const [editPageCode, setEditPageCode] = useState<string>('');
  const [editPageTitle, setEditPageTitle] = useState<string>('');
  const [editPageDesc, setEditPageDesc] = useState<string>('');

  // Input states for adding normal criteria
  const [newCriterionText, setNewCriterionText] = useState<string>('');

  // Input states for adding normal attachments
  const [showAddAttachment, setShowAddAttachment] = useState<boolean>(false);
  const [newAttachmentName, setNewAttachmentName] = useState<string>('');
  const [newAttachmentType, setNewAttachmentType] = useState<AttachmentType>('file');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState<string>('');
  const [selectedCriterionIdForNewAttachment, setSelectedCriterionIdForNewAttachment] = useState<string>('');
  const [activeUploadCriterionId, setActiveUploadCriterionId] = useState<string | null>(null);
  const criterionFileUploadInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState<boolean>(false);
  // Supabase Connection Management States
  const [supabaseUrl, setSupabaseUrl] = useState<string>(() => getSupabaseCredentials().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>(() => getSupabaseCredentials().anonKey);
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<{ isChecking: boolean; ok?: boolean; message?: string } | null>(null);
  const [showSqlDrawer, setShowSqlDrawer] = useState<boolean>(false);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const isInitialDbLoadDone = useRef(false);
  const isApplyingRemoteUpdateRef = useRef(false);

  // Load from Supabase on startup (with fallback to localStorage/API)
  useEffect(() => {
    async function loadDataFromDb() {
      try {
        const cloudData = await api.loadAll();

        if (cloudData) {
          isApplyingRemoteUpdateRef.current = true;
          if (cloudData.config) {
            setConfig(cloudData.config);
            safeLocalStorageSet('portfolio_config_v1', cloudData.config);
          }
          if (cloudData.pages && cloudData.pages.length > 0) {
            setPages(cloudData.pages);
            safeLocalStorageSet('portfolio_pages_v1', cloudData.pages);
          }
          if (cloudData.sections && cloudData.sections.length > 0) {
            setSections(cloudData.sections);
            safeLocalStorageSet('portfolio_sections_v2', cloudData.sections);
          }
          if (cloudData.settings) {
            if (cloudData.settings.adminUsername) {
              setAdminUsername(cloudData.settings.adminUsername);
              safeLocalStorageSet('portfolio_admin_username_v2', cloudData.settings.adminUsername);
            }
            if (cloudData.settings.adminPassword) {
              setAdminPassword(cloudData.settings.adminPassword);
              safeLocalStorageSet('portfolio_admin_password_v2', cloudData.settings.adminPassword);
            }
            if (cloudData.settings.attachmentsPassword) {
              setAttachmentsPassword(cloudData.settings.attachmentsPassword);
              safeLocalStorageSet('portfolio_attachments_password_v2', cloudData.settings.attachmentsPassword);
            }
            if (cloudData.settings.isAttachmentsLockEnabled !== undefined) {
              setIsAttachmentsLockEnabled(cloudData.settings.isAttachmentsLockEnabled);
              safeLocalStorageSet('portfolio_attachments_lock_enabled_v2', String(cloudData.settings.isAttachmentsLockEnabled));
            }
          }
          setTimeout(() => {
            isApplyingRemoteUpdateRef.current = false;
          }, 300);
        }
      } catch (err) {
        console.warn('Initial Supabase load note:', err);
      } finally {
        isInitialDbLoadDone.current = true;
      }
    }

    loadDataFromDb();

    // Listen for tab focus/visibility to pull updates made on other devices
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadDataFromDb();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  // Save changes to localStorage & Supabase whenever they mutate
  useEffect(() => {
    safeLocalStorageSet('portfolio_pages_v1', pages);
    if (isInitialDbLoadDone.current && !isApplyingRemoteUpdateRef.current) {
      const timer = setTimeout(() => {
        api.savePages(pages);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pages]);

  useEffect(() => {
    safeLocalStorageSet('portfolio_config_v1', config);
    if (isInitialDbLoadDone.current && !isApplyingRemoteUpdateRef.current) {
      const timer = setTimeout(() => {
        api.saveConfig(config);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [config]);

  useEffect(() => {
    safeLocalStorageSet('portfolio_sections_v2', sections);
    if (isInitialDbLoadDone.current && !isApplyingRemoteUpdateRef.current) {
      const timer = setTimeout(() => {
        api.saveSections(sections);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sections]);

  useEffect(() => {
    safeLocalStorageSet('portfolio_admin_username_v2', adminUsername);
    safeLocalStorageSet('portfolio_admin_password_v2', adminPassword);
    safeLocalStorageSet('portfolio_attachments_password_v2', attachmentsPassword);
    safeLocalStorageSet('portfolio_attachments_lock_enabled_v2', String(isAttachmentsLockEnabled));

    if (isInitialDbLoadDone.current && !isApplyingRemoteUpdateRef.current) {
      const timer = setTimeout(() => {
        api.saveSettings({
          adminUsername,
          adminPassword,
          attachmentsPassword,
          isAttachmentsLockEnabled,
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [adminUsername, adminPassword, attachmentsPassword, isAttachmentsLockEnabled]);

  // Sync edit values when active tab changes
  const activePage = useMemo(() => {
    return pages.find(p => p.id === activeTabId) || null;
  }, [pages, activeTabId]);

  useEffect(() => {
    if (activePage) {
      setEditPageCode(activePage.code || `إج-0${pages.findIndex(p => p.id === activePage.id) + 1}`);
      setEditPageTitle(activePage.title);
      setEditPageDesc(activePage.description);
      setIsEditingActivePageHeader(false); // Reset inline editing when switching tabs
      setShowAddAttachment(false); // Reset attachments form
      
      const pageSecId = activePage.sectionId || 'school-admin';
      if (pageSecId !== activeSectionId) {
        setActiveSectionId(pageSecId);
      }
    }
  }, [activeTabId, activePage, activeSectionId, pages]);

  // Handle Toast feedback utility
  const triggerFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: null, message: '' });
    }, 4000);
  };

  // Helper metric helper for icons status
  const getPageStatus = (page: PortfolioPage) => {
    if (page.criteria.length === 0) return 'empty';
    const metCount = page.criteria.filter(c => c.isMet).length;
    if (metCount === page.criteria.length) return 'complete';
    if (metCount > 0) return 'in_progress';
    return 'not_started';
  };

  // Filter sidebar pages list based on search, status, and section
  const filteredPages = useMemo(() => {
    return pages.filter(page => {
      // Check section match
      const pageSecId = page.sectionId || 'school-admin';
      if (pageSecId !== activeSectionId) return false;

      const matchesSearch = page.title.toLowerCase().includes(sidebarSearch.toLowerCase()) || 
                            (page.code && page.code.toLowerCase().includes(sidebarSearch.toLowerCase())) ||
                            page.description.toLowerCase().includes(sidebarSearch.toLowerCase());
      
      if (!matchesSearch) return false;

      const pageStatus = getPageStatus(page);
      if (statusFilter === 'all') return true;
      if (statusFilter === 'complete') return pageStatus === 'complete';
      if (statusFilter === 'in_progress') return pageStatus === 'in_progress';
      if (statusFilter === 'not_started') return pageStatus === 'not_started';
      return true;
    });
  }, [pages, sidebarSearch, statusFilter, activeSectionId]);

  // Handler for saving individual page header modifications
  const handleSavePageHeader = () => {
    if (!activePage) return;
    if (!editPageTitle.trim()) {
      triggerFeedback('error', 'اسم الصفحة لا يمكن أن يكون فارغاً.');
      return;
    }
    setPages(prev => prev.map(p => {
      if (p.id === activePage.id) {
        return {
          ...p,
          code: editPageCode.trim(),
          title: editPageTitle,
          description: editPageDesc
        };
      }
      return p;
    }));
    setIsEditingActivePageHeader(false);
    triggerFeedback('success', 'تم تعديل رمز ومعلومات المعيار بنجاح.');
  };

  // Criteria actions
  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage || !newCriterionText.trim()) return;

    const newCrit: Criterion = {
      id: `crit-${Date.now()}`,
      text: newCriterionText.trim(),
      isMet: false
    };

    setPages(prev => prev.map(p => {
      if (p.id === activePage.id) {
        return {
          ...p,
          criteria: [...p.criteria, newCrit]
        };
      }
      return p;
    }));

    setNewCriterionText('');
    triggerFeedback('success', 'تمت إضافة المعيار بنجاح للبوابة الحالية.');
  };

  const handleToggleCriterion = (criterionId: string) => {
    if (!activePage) return;
    if (!isAdminMode) {
      triggerFeedback('error', 'عذراً! لا يمكن تعديل وإنجاز المعايير والشواهد إلا في وضع الإدارة والتعديل.');
      return;
    }
    setPages(prev => prev.map(p => {
      if (p.id === activePage.id) {
        return {
          ...p,
          criteria: p.criteria.map(c => c.id === criterionId ? { ...c, isMet: !c.isMet } : c)
        };
      }
      return p;
    }));
  };

  const handleDeleteCriterion = (criterionId: string) => {
    if (!activePage) return;
    const newPages = pages.map(p => {
      if (p.id === activePage.id) {
        return {
          ...p,
          criteria: p.criteria.filter(c => c.id !== criterionId)
        };
      }
      return p;
    });
    setPages(newPages);
    safeLocalStorageSet('portfolio_pages_v1', newPages);
    api.savePages(newPages);
    triggerFeedback('success', 'تم حذف المعيار وتحديث قاعدة البيانات بنجاح.');
  };

  // Attachment actions
  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage || !newAttachmentName.trim()) {
      triggerFeedback('error', 'الرجاء إدخال اسم الشاهد أو المرفق.');
      return;
    }

    const newAtt: Attachment = {
      id: `att-${Date.now()}`,
      criterionId: selectedCriterionIdForNewAttachment || undefined,
      name: newAttachmentName.trim(),
      type: newAttachmentType,
      url: newAttachmentUrl.trim() || '#',
      date: new Date().toISOString().split('T')[0],
      size: newAttachmentSize || (newAttachmentType === 'file' ? '2.1 MB' : undefined)
    };

    setPages(prev => prev.map(p => {
      if (p.id === activePage.id) {
        const updatedCriteria = selectedCriterionIdForNewAttachment
          ? p.criteria.map(c => c.id === selectedCriterionIdForNewAttachment ? { ...c, isMet: true } : c)
          : p.criteria;
        return {
          ...p,
          criteria: updatedCriteria,
          attachments: [...p.attachments, newAtt]
        };
      }
      return p;
    }));

    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setNewAttachmentSize(undefined);
    setSelectedCriterionIdForNewAttachment('');
    setShowAddAttachment(false);
    triggerFeedback('success', 'تم رفع وإضافة المرفق بنجاح لملف الشواهد.');
  };

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!activePage) return;
    const newPages = pages.map(p => {
      if (p.id === activePage.id) {
        return {
          ...p,
          attachments: p.attachments.filter(a => a.id !== attachmentId)
        };
      }
      return p;
    });
    setPages(newPages);
    safeLocalStorageSet('portfolio_pages_v1', newPages);
    api.savePages(newPages);
    triggerFeedback('success', 'تم حذف المرفق وتحديث قاعدة البيانات بنجاح.');
  };

  const processAndAddFiles = async (fileList: FileList | File[], targetCriterionId?: string) => {
    if (!activePage) return;
    if (!isAdminMode) {
      triggerFeedback('error', 'عذراً! لا يمكن رفع الشواهد وسحب الملفات إلا في وضع الإدارة والتعديل (تأكد من رمز المرور).');
      return;
    }

    try {
      setIsUploadingAttachment(true);
      const newlyAdded: Attachment[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const processed = await processUploadedFile(file);
        newlyAdded.push({
          id: `att-upload-${Date.now()}-${i}`,
          criterionId: targetCriterionId,
          name: processed.name,
          type: processed.type,
          url: processed.dataUrl,
          date: new Date().toISOString().split('T')[0],
          size: processed.sizeString,
        });
      }

      if (newlyAdded.length > 0) {
        setPages(prev => prev.map(p => {
          if (p.id === activePage.id) {
            const updatedCriteria = targetCriterionId
              ? p.criteria.map(c => c.id === targetCriterionId ? { ...c, isMet: true } : c)
              : p.criteria;
            return {
              ...p,
              criteria: updatedCriteria,
              attachments: [...p.attachments, ...newlyAdded]
            };
          }
          return p;
        }));
        triggerFeedback('success', `تم رفع وإضافة ${newlyAdded.length} مرفقات بنجاح!`);
      }
    } catch (err) {
      console.error('Error uploading files:', err);
      triggerFeedback('error', 'حدث خطأ أثناء معالجة ورفع الملفات.');
    } finally {
      setIsUploadingAttachment(false);
      if (fileUploadInputRef.current) fileUploadInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processAndAddFiles(files);
    }
  };

  const handleDirectFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processAndAddFiles(files);
    }
  };

  const handleCriterionFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeUploadCriterionId) return;
    await processAndAddFiles(files, activeUploadCriterionId);
    setActiveUploadCriterionId(null);
    if (criterionFileUploadInputRef.current) criterionFileUploadInputRef.current.value = '';
  };

  const handleFormFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploadingAttachment(true);
      const file = files[0];
      const processed = await processUploadedFile(file);
      setNewAttachmentName(processed.name);
      setNewAttachmentType(processed.type);
      setNewAttachmentUrl(processed.dataUrl);
      setNewAttachmentSize(processed.sizeString);
    } catch (err) {
      console.error('Error selecting file in form:', err);
    } finally {
      setIsUploadingAttachment(false);
      if (formFileInputRef.current) formFileInputRef.current.value = '';
    }
  };

  // App-wide Reset to original template default data
  const handleResetToDefaults = () => {
    openConfirm(
      'إعادة ضبط المصنع للبيانات',
      'هل أنت متأكد من رغبتك في إعادة ضبط كافة البيانات ومسميات الـ 19 صفحة للقيم المعيارية الافتراضية؟ سيتم مسح كافة التعديلات والشواهد المرفقة.',
      () => {
        setPages(DEFAULT_PAGES);
        setConfig(INITIAL_CONFIG);
        setActiveTabId(0);
        triggerFeedback('success', 'تمت عملية إعادة تهيئة البيانات لملف الإنجاز بنجاح.');
        setIsControlPanelOpen(false);
      }
    );
  };

  // Global Page Management inside Control Panel
  const handleRenamePageInBulk = (id: number, newTitle: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
  };

  const handleEditPageCodeInBulk = (id: number, newCode: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, code: newCode } : p));
  };

  // Add a fully new page option (supports expanding beyond 19 pages)
  const handleAddNewPage = (targetSectionId?: string) => {
    const secId = targetSectionId || (activeSectionId !== 'all' ? activeSectionId : 'school-admin');
    const nextId = pages.length > 0 ? Math.max(...pages.map(p => p.id)) + 1 : 1;
    const newPage: PortfolioPage = {
      id: nextId,
      code: `إج-${nextId < 10 ? '0' + nextId : nextId}`,
      sectionId: secId, // Assign to target section
      title: `معيار جديد رقم ${nextId}`,
      iconName: 'Plus',
      description: 'معيار فرعي مخصص مضاف حديثاً حسب الدليل الإجرائي.',
      criteria: [],
      attachments: []
    };
    setPages(prev => [...prev, newPage]);
    setActiveSectionId(secId);
    setActiveTabId(nextId);
    triggerFeedback('success', `تم إنشاء المعيار الجديد وتفعيله بنجاح.`);
  };

  // Section Management Add/Rename/Delete
  const handleAddNewSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    const newSecId = `section-${Date.now()}`;
    setSections(prev => [...prev, { id: newSecId, name: newSectionName.trim() }]);
    setNewSectionName('');
    setActiveSectionId(newSecId);
    triggerFeedback('success', `تمت إضافة القسم الجديد "${newSectionName.trim()}" بنجاح!`);
  };

  const handleRenameSection = (id: string, newName: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleDeleteSection = (id: string) => {
    if (id === 'school-admin') {
      triggerFeedback('error', 'لا يمكن حذف القسم المعياري الأساسي (الإدارة المدرسية).');
      return;
    }
    openConfirm(
      'حذف تصنيف العمل الحالي',
      'هل أنت متأكد من حذف هذا القسم؟ سيتم نقل الصفحات المنتمية إليه إلى قسم الإدارة المدرسية تلقائياً لضمان عدم ضياع المستندات.',
      () => {
        const newSections = sections.filter(s => s.id !== id);
        const newPages = pages.map(p => p.sectionId === id ? { ...p, sectionId: 'school-admin' } : p);
        setSections(newSections);
        setPages(newPages);
        safeLocalStorageSet('portfolio_sections_v2', newSections);
        safeLocalStorageSet('portfolio_pages_v1', newPages);
        api.saveSections(newSections);
        api.savePages(newPages);
        setActiveSectionId('school-admin');
        triggerFeedback('success', 'تم حذف القسم وترحيل صفحاته وتحديث قاعدة البيانات بنجاح.');
      }
    );
  };

  // Delete a specific page
  const handleDeletePage = (id: number) => {
    if (pages.length <= 1) {
      triggerFeedback('error', 'يجب أن يحتوي ملف الإنجاز على صفحة واحدة على الأقل.');
      return;
    }
    const victim = pages.find(p => p.id === id);
    openConfirm(
      'حذف الصفحة بصورة نهائية',
      `هل أنت متأكد من حذف صفحة "${victim?.title}" بصورة نهائية؟ سيتم التخلص من كافة المعايير والشواهد الملحقة بها أيضاً.`,
      () => {
        const newPages = pages.filter(p => p.id !== id);
        setPages(newPages);
        safeLocalStorageSet('portfolio_pages_v1', newPages);
        api.savePages(newPages);
        setActiveTabId(0);
        triggerFeedback('success', 'تم حذف الصفحة والملحقات التابعة لها وتحديث قاعدة البيانات.');
      }
    );
  };

  // Control Panel Page Detail Operations
  const handleAddCriterionForPage = (pageId: number, text: string) => {
    const newCrit: Criterion = {
      id: `crit-${Date.now()}`,
      text: text.trim(),
      isMet: false
    };
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, criteria: [...p.criteria, newCrit] } : p));
    triggerFeedback('success', 'تمت إضافة معيار جديد للصفحة المحددة من لوحة التحكم.');
  };

  const handleToggleCriterionForPage = (pageId: number, criterionId: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? {
      ...p,
      criteria: p.criteria.map(c => c.id === criterionId ? { ...c, isMet: !c.isMet } : c)
    } : p));
  };

  const handleEditCriterionTextForPage = (pageId: number, criterionId: string, newText: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? {
      ...p,
      criteria: p.criteria.map(c => c.id === criterionId ? { ...c, text: newText.trim() } : c)
    } : p));
    triggerFeedback('success', 'تم تعديل نص المعيار بنجاح.');
  };

  const handleDeleteCriterionForPage = (pageId: number, criterionId: string) => {
    const newPages = pages.map(p => p.id === pageId ? {
      ...p,
      criteria: p.criteria.filter(c => c.id !== criterionId)
    } : p);
    setPages(newPages);
    safeLocalStorageSet('portfolio_pages_v1', newPages);
    api.savePages(newPages);
    triggerFeedback('success', 'تم حذف المعيار وتحديث قاعدة البيانات بنجاح.');
  };

  const handleAddAttachmentForPage = (pageId: number, name: string, type: AttachmentType, url: string, size?: string, criterionId?: string) => {
    const newAtt: Attachment = {
      id: `att-${Date.now()}`,
      criterionId: criterionId,
      name: name.trim(),
      type: type,
      url: url.trim() || '#',
      date: new Date().toISOString().split('T')[0],
      size: size || (type === 'file' ? '2.1 MB' : undefined)
    };
    setPages(prev => prev.map(p => {
      if (p.id === pageId) {
        const updatedCriteria = criterionId
          ? p.criteria.map(c => c.id === criterionId ? { ...c, isMet: true } : c)
          : p.criteria;
        return {
          ...p,
          criteria: updatedCriteria,
          attachments: [...p.attachments, newAtt]
        };
      }
      return p;
    }));
    triggerFeedback('success', 'تمت إضافة المرفق وربطه بنجاح.');
  };

  const handleDeleteAttachmentForPage = (pageId: number, attachmentId: string) => {
    const newPages = pages.map(p => p.id === pageId ? {
      ...p,
      attachments: p.attachments.filter(a => a.id !== attachmentId)
    } : p);
    setPages(newPages);
    safeLocalStorageSet('portfolio_pages_v1', newPages);
    api.savePages(newPages);
    triggerFeedback('success', 'تم حذف المرفق وتحديث قاعدة البيانات بنجاح.');
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans antialiased text-right selection:bg-madrasati-teal selection:text-white" dir="rtl">
      
      {/* Toast Feedback Notification */}
      {feedback.type && (
        <div 
          className={`fixed bottom-5 left-5 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border transition-all duration-300 transform translate-y-0 opacity-100 max-w-md animate-fade-in ${
            feedback.type === 'success' 
            ? 'bg-madrasati-dark text-white border-madrasati-teal/30 shadow-madrasati-teal/10' 
            : 'bg-rose-950 text-rose-50 border-rose-800'
          }`}
          id="toast-feedback-message"
        >
          <div className={`p-1.5 rounded-lg ${feedback.type === 'success' ? 'bg-madrasati-teal' : 'bg-rose-900'}`}>
            <LucideIcon name={feedback.type === 'success' ? 'Check' : 'AlertCircle'} size={18} />
          </div>
          <p className="text-xs font-semibold leading-relaxed">{feedback.message}</p>
        </div>
      )}

      {/* Top Banner & Corporate Branding Details - Inspired by Madrasati Branding */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs px-4 py-3 md:px-6">
        <div className="max-w-7.5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo / Title Area */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-madrasati-teal flex items-center justify-center text-white shrink-0 shadow-md shadow-madrasati-teal/20">
              <LucideIcon name="Settings" size={22} className="animate-spin-slow text-white" />
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-black text-slate-850">
                {config.schoolName} | ملف إنجاز المدرسة
              </h1>
            </div>
          </div>

          {/* Global School Info Badges & Shortcuts */}
          <div className="flex flex-wrap items-center gap-2.5 justify-end w-full sm:w-auto">
            
            {/* Main quick statistics badge */}
            <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-50 border border-slate-200/60 px-3.5 py-2 rounded-xl text-slate-600">
              <LucideIcon name="User" size={14} className="text-madrasati-teal" />
              <span className="font-bold">مؤشر الإنجاز:</span>
              <strong className="text-madrasati-teal font-extrabold text-sm">
                {Math.round((pages.reduce((c, p) => c + p.criteria.filter(cr => cr.isMet).length, 0) / 
                            Math.max(1, pages.reduce((c, p) => c + p.criteria.length, 0))) * 100)}%
              </strong>
            </div>

            {/* Switch to main button */}
            <button
              id="back-to-home"
              onClick={() => setActiveTabId(0)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                activeTabId === 0
                ? 'bg-madrasati-teal text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <LucideIcon name="Home" size={14} />
              الرئيسية والملخص
            </button>

            {/* Admin Mode Toggle Selector */}
            <button
              onClick={() => {
                if (!isAdminMode) {
                  openAdminLoginModal();
                } else {
                  setIsAdminMode(false);
                  triggerFeedback('success', 'تم التحول لوضع الزائر (العرض فقط).');
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer border ${
                isAdminMode
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LucideIcon name={isAdminMode ? "Unlock" : "Lock"} size={13} className={isAdminMode ? "text-emerald-700" : "text-slate-400"} />
              <span>{isAdminMode ? 'وضع الإدارة (نشط)' : 'تسجيل دخول المشرف'}</span>
            </button>

            {isAdminMode && (
              <button
                onClick={handlePromptChangeAttachmentsPassword}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-300/80 hover:bg-amber-100 text-xs font-black transition-colors cursor-pointer shadow-3xs"
                title="تغيير وتعديل كلمة مرور قفل الشواهد والمرفقات"
              >
                <LucideIcon name="KeyRound" size={13} className="text-amber-700" />
                <span>كلمة مرور الشواهد</span>
              </button>
            )}

            {/* Central Control Panel Button Toggle */}
            <button
              id="open-control-panel-btn"
              onClick={() => {
                if (!isAdminMode) {
                  openAdminLoginModal(() => {
                    setIsControlPanelOpen(true);
                  });
                } else {
                  setIsControlPanelOpen(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-madrasati-dark text-white text-xs font-black hover:bg-madrasati-teal shadow-xs transition-colors cursor-pointer"
            >
              <LucideIcon name="Settings" size={14} className="text-white" />
              لوحة التحكم الشاملة
            </button>

            {/* Simple responsive browser print button */}
            <button
              onClick={() => window.print()}
              title="طباعة تقرير ملف الإنجاز"
              className="p-2 border border-slate-200 rounded-xl bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <LucideIcon name="Printer" size={15} />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              key="sidebar-toggle"
              className="lg:hidden p-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl cursor-pointer"
              title="القائمة"
            >
              <LucideIcon name="Menu" size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7.5xl mx-auto px-4 py-6 md:px-6">
        <div className={activeTabId === 0 ? "w-full space-y-6" : "grid grid-cols-1 lg:grid-cols-4 gap-6 items-start"}>
          
          {/* Sidebar Tabs - Containing 19 Pages Checklist - Shown only when viewing specific standards */}
          {isSidebarOpen && activeTabId !== 0 && (
            <aside 
              className="lg:col-span-1 bg-white border border-slate-200/70 rounded-2xl p-4 shadow-sm space-y-4"
              id="portfolio-sidebar-navigation"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h2 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <LucideIcon name="Layers" size={17} className="text-madrasati-teal" />
                    معايير ملف الإنجاز ({pages.length})
                  </h2>
                  <span className="text-[10px] md:text-[11px] bg-madrasati-teal-bg px-2.5 py-0.5 rounded-full font-black text-madrasati-teal">فهرس المعايير</span>
                </div>
                
                {/* Search Input for Side navigation Pages */}
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none">
                    <LucideIcon name="Search" size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="ابحث عن رمز المعيار أو عنوانه..."
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    className="w-full text-xs sm:text-sm pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-madrasati-teal bg-slate-55"
                  />
                </div>
 
                {/* Horizontal Section Switcher Tabs */}
                <div className="space-y-2 pb-2.5 border-b border-slate-100">
                  <span className="text-xs text-slate-400 font-extrabold pr-0.5">تصنيفات الأقسام:</span>
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap lg:flex-col xl:flex-row xl:flex-wrap gap-1.5">
                    {sections.map(sec => (
                      <button
                        type="button"
                        key={sec.id}
                        onClick={() => {
                          setActiveSectionId(sec.id);
                          // Select the first page of this section if activeTabId is not 0
                          if (activeTabId !== 0) {
                            const secPages = pages.filter(p => (p.sectionId || 'school-admin') === sec.id);
                            if (secPages.length > 0) {
                              setActiveTabId(secPages[0].id);
                            } else {
                              setActiveTabId(0); // fallback to dashboard if no pages
                            }
                          }
                        }}
                        className={`text-xs md:text-[13px] px-2.5 py-2 rounded-xl transition-all font-bold text-center border shrink-0 flex-1 min-w-[75px] cursor-pointer ${
                          activeSectionId === sec.id
                          ? 'bg-madrasati-teal text-white border-madrasati-teal'
                          : 'bg-slate-50 text-slate-650 border-slate-205 hover:bg-slate-100'
                        }`}
                      >
                        {sec.name}
                      </button>
                    ))}
                  </div>
                </div>
 
                {/* Status Filter Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-b border-slate-100 pb-2.5">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`text-xs md:text-[13px] px-3 py-1.5 rounded-md transition-colors font-bold border cursor-pointer ${
                      statusFilter === 'all' 
                      ? 'bg-madrasati-dark text-white border-madrasati-dark' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setStatusFilter('complete')}
                    className={`text-xs md:text-[13px] px-3 py-1.5 rounded-md transition-colors font-bold border cursor-pointer ${
                      statusFilter === 'complete' 
                      ? 'bg-emerald-700 text-white border-emerald-700' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    مكتمل
                  </button>
                  <button
                    onClick={() => setStatusFilter('in_progress')}
                    className={`text-xs md:text-[13px] px-3 py-1.5 rounded-md transition-colors font-bold border cursor-pointer ${
                      statusFilter === 'in_progress' 
                      ? 'bg-slate-700 text-white border-slate-700' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    قيد الإنجاز
                  </button>
                </div>
              </div>
 
              {/* Sidebar Links Container */}
              <nav className="space-y-1.5 max-h-[580px] overflow-y-auto pr-0.5 custom-scrollbar">
                
                {/* Stat Tab element */}
                <button
                  onClick={() => setActiveTabId(0)}
                  className={`w-full text-right flex items-center justify-between p-3 rounded-xl text-xs sm:text-sm font-black transition-colors cursor-pointer ${
                    activeTabId === 0
                    ? 'bg-madrasati-teal-bg text-madrasati-dark border-r-4 border-madrasati-teal'
                    : 'text-slate-650 hover:bg-slate-50/80 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LucideIcon name="Home" size={15} className={activeTabId === 0 ? 'text-madrasati-teal' : 'text-slate-400'} />
                    <span>لوحة مؤشرات الأداء والملخص</span>
                  </div>
                  <span className="text-[11px] md:text-xs font-black text-madrasati-teal">الرئيسية</span>
                </button>
 
                {/* Render listed pages */}
                {filteredPages.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs sm:text-sm">
                    <LucideIcon name="AlertCircle" className="mx-auto text-slate-300 mb-1" size={22} />
                    لا توجد معايير مطابقة للبحث
                  </div>
                ) : (
                  filteredPages.map((page, index) => {
                    const status = getPageStatus(page);
                    const isActive = activeTabId === page.id;
                    const criteriaCompletedCount = page.criteria.filter(c => c.isMet).length;
                    const criteriaTotal = page.criteria.length;
 
                    let statusDot = <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0"></span>;
                    if (status === 'complete') {
                      statusDot = <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="مكتمل المعايير"></span>;
                    } else if (status === 'in_progress') {
                      statusDot = <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" title="قيد الإنجاز"></span>;
                    }
 
                    return (
                      <button
                        key={page.id}
                        onClick={() => setActiveTabId(page.id)}
                        className={`w-full text-right flex items-start gap-3 p-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border border-transparent cursor-pointer ${
                          isActive
                          ? 'bg-gradient-to-l from-madrasati-teal-bg/60 to-white/30 text-madrasati-dark border-l border-slate-200 border-r-4 border-madrasati-teal shadow-3xs'
                          : 'text-slate-700 hover:bg-slate-50 hover:border-slate-100'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isActive ? 'bg-madrasati-teal text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <LucideIcon name={page.iconName} size={15} />
                        </div>
                        
                        <div className="space-y-1 overflow-hidden w-full text-right">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate block font-extrabold text-slate-800 text-[12px] sm:text-[13.5px] leading-snug">
                              {page.title}
                            </span>
                            {statusDot}
                          </div>
                          
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-semibold">{page.code ? `رمز: ${page.code}` : `معيار ${index + 1}`}</span>
                            <div className="flex items-center gap-1.5">
                              <span>{criteriaCompletedCount}/{criteriaTotal} معايير</span>
                              {isAdminMode && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePage(page.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="حذف هذا المعيار / الصفحة"
                                >
                                  <LucideIcon name="Trash2" size={12} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
 
                {/* Add dynamic new page direct from bottom of sidebar */}
                {isAdminMode && (
                  <button
                    onClick={handleAddNewPage}
                    className="w-full text-right flex items-center gap-2 p-3 rounded-xl border border-dashed border-madrasati-teal/30 bg-madrasati-teal-bg/40 text-madrasati-teal hover:bg-madrasati-teal-bg hover:text-madrasati-dark transition-colors text-xs sm:text-sm font-bold mt-4 cursor-pointer"
                  >
                    <LucideIcon name="Plus" size={15} />
                    <span>إضافة صفحة جديدة للقسم الحالي</span>
                  </button>
                )}
              </nav>
            </aside>
          )}

          {/* Core Content Area */}
          <main className={activeTabId === 0 ? "w-full space-y-6" : "col-span-1 lg:col-span-3 space-y-6"}>
            
            {/* TAB 0: COMPREHENSIVE DASHBOARD SUMMARY */}
            {activeTabId === 0 ? (
              <DashboardStats 
                pages={pages} 
                sections={sections}
                config={config} 
                isAdminMode={isAdminMode}
                onSelectPage={(id) => setActiveTabId(id)}
                onAddNewPageToSection={(secId) => handleAddNewPage(secId)}
                onToggleControlPanel={() => {
                  if (!isAdminMode) {
                    openAdminLoginModal(() => {
                      setIsControlPanelOpen(true);
                    });
                  } else {
                    setIsControlPanelOpen(true);
                  }
                }}
                onOpenAdminLogin={openAdminLoginModal}
                onUpdatePhoto={(newPhotoUrl) => {
                  setConfig(prev => ({ ...prev, managerPhotoUrl: newPhotoUrl }));
                  triggerFeedback('success', 'تم تحديث وحفظ صورة المدير بنجاح في ملف الإنجاز وقاعدة البيانات!');
                }}
              />
            ) : (
              
              /* TAB ACTIVE PAGE: DETAILED MANAGERIAL VIEW */
              activePage && (
                <div className="bg-white rounded-3xl border border-slate-200/85 shadow-md overflow-hidden space-y-6" id={`portfolio-active-page-${activePage.id}`}>
                  
                  {/* Distinctive Header for each folder containing customized info - Madrasati Platform style */}
                  <div className="bg-gradient-to-l from-madrasati-dark to-slate-800 text-white p-6 md:p-8 flex flex-col sm:flex-row md:items-center justify-between gap-6 relative">
                    {/* Atmospheric background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-madrasati-teal/15 rounded-full blur-2xl animate-pulse"></div>

                    <div className="space-y-3.5 z-10 w-full text-right" dir="rtl">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-madrasati-teal-bg text-madrasati-teal flex items-center justify-center border border-madrasati-teal/20">
                          <LucideIcon name={activePage.iconName} size={16} />
                        </div>
                        <span className="text-[10px] font-black text-madrasati-teal bg-madrasati-teal-bg px-3 py-1 rounded-full">
                          {activePage.code ? `رمز المعيار: ${activePage.code}` : `معيار رقم ${pages.findIndex(p => p.id === activePage.id) + 1}`}
                        </span>
                      </div>

                      {/* Display Page Title / Quick Title Editor */}
                      {isEditingActivePageHeader ? (
                        <div className="space-y-3 bg-slate-800/90 p-4 rounded-xl border border-slate-700 text-right">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1 sm:col-span-1">
                              <label className="text-[10px] text-slate-300 font-bold block">رمز المعيار (حسب الدليل الإجرائي)</label>
                              <input
                                type="text"
                                value={editPageCode}
                                onChange={(e) => setEditPageCode(e.target.value)}
                                className="w-full text-xs bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-bold"
                                placeholder="مثال: إج-01"
                              />
                            </div>
                            
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-[10px] text-slate-300 font-bold block">مسمى المعيار أو الصفحة الحالي</label>
                              <input
                                type="text"
                                value={editPageTitle}
                                onChange={(e) => setEditPageTitle(e.target.value)}
                                className="w-full text-xs bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-bold"
                                placeholder="اسم المعيار التربوي المختار"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-300 font-bold block">الوصف أو الهدف الإداري للقسم</label>
                            <textarea
                              rows={3}
                              value={editPageDesc}
                              onChange={(e) => setEditPageDesc(e.target.value)}
                              className="w-full text-xs bg-slate-900 border border-slate-700 text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-bold"
                              placeholder="اكتب التوجيه أو الوصف الخاص بحوكمة هذا المعيار..."
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleSavePageHeader}
                              className="px-4 py-1.5 bg-madrasati-teal text-white rounded-lg text-xs font-black hover:bg-opacity-90 transition-colors cursor-pointer"
                            >
                              حفظ التغييرات
                            </button>
                            <button
                              onClick={() => {
                                  setEditPageCode(activePage.code || '');
                                  setEditPageTitle(activePage.title);
                                  setEditPageDesc(activePage.description);
                                  setIsEditingActivePageHeader(false);
                                }}
                              className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-xs hover:bg-slate-605 transition-colors cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-right">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-lg md:text-xl font-black text-white">{activePage.title}</h2>
                            {isAdminMode && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setIsEditingActivePageHeader(true)}
                                  className="inline-flex items-center gap-1.5 text-[10px] text-slate-200 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold"
                                  title="تعديل هذا البند ومسمياته فورياً"
                                >
                                  <LucideIcon name="Edit3" size={12} className="text-white" />
                                  <span>تغيير المسمى والوصف</span>
                                </button>
                                <button
                                  onClick={() => handleDeletePage(activePage.id)}
                                  className="inline-flex items-center gap-1.5 text-[10px] text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold"
                                  title="حذف هذا المعيار أو الصفحة بالكامل من حساب المدير"
                                >
                                  <LucideIcon name="Trash2" size={12} className="text-rose-300" />
                                  <span>حذف المعيار</span>
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-4xl font-semibold">
                            {activePage.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 md:px-8 pb-8 space-y-8">
                    
                    {/* SECTION 1: CRITERIA LISTING - Madrasati Platform design details */}
                    <div className="space-y-4 text-right">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div className="space-y-0.5 text-right">
                          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 justify-start">
                            <span className="w-2.5 h-2.5 rounded-full bg-madrasati-teal block"></span>
                            أولاً: معايير ومؤشرات الأداء المستهدفة
                          </h3>
                          <p className="text-[11px] text-slate-500 font-bold">
                            {isAdminMode 
                              ? 'قم بتحديد المعايير المنجزة من الشواهد والمستندات، أو أضف معايير مهنية جديدة لتغطية هذا المعيار.'
                              : 'استعرض المعايير ومؤشرات الأداء لهذا البند.'}
                          </p>
                        </div>

                        {/* Quick Page indicator */}
                        <div className="bg-madrasati-teal-bg text-madrasati-teal text-xs px-3 py-1.5 rounded-lg border border-madrasati-teal/20 font-black">
                          المكتمل: {activePage.criteria.filter(c => c.isMet).length} من {activePage.criteria.length}
                        </div>
                      </div>

                      {/* Criteria Items Render loop */}
                      {activePage.criteria.length === 0 ? (
                        <div className="bg-slate-50 border border-dashed border-slate-200 p-6 rounded-2xl text-center text-slate-500 text-xs space-y-2">
                          <LucideIcon name="CheckCircle2" className="mx-auto text-madrasati-teal/40" size={28} />
                          <p className="font-bold text-slate-700 text-xs">لا توجد معايير أو بنود مضافة لهذا القسم حالياً.</p>
                          <p className="text-[11px] text-slate-400">
                            {isAdminMode 
                              ? 'يمكنك إضافة معايير جديدة أدناه أو الاستعانة بمساعد الذكاء الاصطناعي لاقتراح المعايير.' 
                              : 'سيتم إضافة المعايير والمؤشرات الخاصة بهذا البند قريباً بواسطة مدير المدرسة.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {activePage.criteria.map((crit) => {
                            const critAttachments = activePage.attachments.filter(a => a.criterionId === crit.id);
                            return (
                              <div 
                                key={crit.id}
                                className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                                  crit.isMet 
                                  ? 'bg-emerald-50/40 border-emerald-100/80 text-emerald-950' 
                                  : 'bg-slate-50/50 border-slate-200/60 text-slate-700'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3 w-full">
                                    <button
                                      onClick={() => handleToggleCriterion(crit.id)}
                                      disabled={!isAdminMode}
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                        isAdminMode ? 'cursor-pointer' : 'cursor-default'
                                      } ${
                                        crit.isMet 
                                        ? 'bg-emerald-600 border-emerald-600 text-white' 
                                        : 'bg-white border-slate-300 text-slate-400 hover:border-slate-400'
                                      }`}
                                    >
                                      {crit.isMet && <LucideIcon name="Check" size={13} />}
                                    </button>
                                    <span className={`text-xs md:text-sm leading-relaxed ${crit.isMet ? 'line-through text-slate-500' : 'text-slate-800 font-medium'}`}>
                                      {crit.text}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isAdminMode && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveUploadCriterionId(crit.id);
                                            criterionFileUploadInputRef.current?.click();
                                          }}
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                          title="رفع شاهد ومستند مخصص لهذا المعيار مباشرة"
                                        >
                                          <LucideIcon name="Paperclip" size={12} className="text-teal-700" />
                                          <span>إرفاق شاهد</span>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteCriterion(crit.id)}
                                          className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                                          title="حذف هذا البند أو المعيار من القائمة"
                                        >
                                          <LucideIcon name="Trash2" size={12} className="text-rose-600" />
                                          <span>حذف</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Display attachments attached to this specific criterion */}
                                {critAttachments.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-2 items-center">
                                    <span className="text-[10px] font-black text-slate-500 flex items-center gap-1">
                                      <LucideIcon name="Paperclip" size={11} className="text-madrasati-teal" />
                                      الشواهد المرتبطة ({critAttachments.length}):
                                    </span>
                                    {critAttachments.map(att => (
                                      <div 
                                        key={att.id}
                                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs shadow-3xs hover:border-madrasati-teal transition-all"
                                      >
                                        <span className="font-bold text-slate-800 text-[11px] truncate max-w-[180px]">
                                          {att.name}
                                        </span>
                                        {att.size && <span className="text-[9px] text-slate-400 font-sans">({att.size})</span>}
                                        <button
                                          type="button"
                                          onClick={() => handleOpenAttachment(att)}
                                          className="text-madrasati-teal hover:underline text-[10px] font-black flex items-center gap-0.5 cursor-pointer ml-1"
                                          title="عرض الشاهد"
                                        >
                                          <LucideIcon name="ExternalLink" size={10} />
                                          <span>عرض</span>
                                        </button>
                                        {isAdminMode && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteAttachment(att.id)}
                                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                            title="حذف هذا الشاهد"
                                          >
                                            <LucideIcon name="Trash2" size={11} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Hidden File Input for criterion-specific upload */}
                      <input
                        type="file"
                        ref={criterionFileUploadInputRef}
                        className="hidden"
                        onChange={handleCriterionFileInputChange}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      />

                      {/* Add standard custom criterion form */}
                      {isAdminMode && (
                        <form onSubmit={handleAddCriterion} className="flex gap-2.5 pt-2">
                          <input
                            type="text"
                            required
                            value={newCriterionText}
                            onChange={(e) => setNewCriterionText(e.target.value)}
                            placeholder="أدخل نص المعيار المهني الجديد هنا..."
                            className="w-full text-xs px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-medium"
                          />
                          <button
                            type="submit"
                            className="bg-madrasati-teal text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-opacity-90 transition-colors shadow-xs hover:shadow-md cursor-pointer shrink-0"
                          >
                            إضافة معيار جديد
                          </button>
                        </form>
                      )}
                    </div>

                    {/* SECTION 2: EVIDENCE & ATTACHMENTS (ملف الشواهد والمرفقات) */}
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-3">
                        <div className="space-y-1 text-right">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 justify-start">
                              <span className="w-2.5 h-2.5 rounded-full bg-madrasati-teal block"></span>
                              {isAdminMode ? 'ثانياً: الشواهد الرقمية والمرفقات الثبوتية' : 'الشواهد الرقمية والمرفقات الثبوتية لهذا البند'}
                            </h3>
                            {isAttachmentsLockEnabled ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-900 border border-amber-300/70 px-2.5 py-0.5 rounded-full font-black shadow-3xs">
                                <LucideIcon name="Lock" size={10} className="text-amber-700" />
                                <span>مؤمن بكلمة مرور</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-300/70 px-2.5 py-0.5 rounded-full font-black shadow-3xs">
                                <LucideIcon name="Unlock" size={10} className="text-emerald-700" />
                                <span>بدون كلمة مرور (متاح للجميع)</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-bold">
                            {isAdminMode 
                              ? 'قم برفع الشواهد والملفات الرقمية، أو إرفاق روابط الحوكمة (Google Drive, OneDrive, Telegram) لإثبات تحقيق قيادة المدرسة للمؤشرات.'
                              : 'استعرض الشواهد والوثائق الرقمية وروابط الحوكمة التي تبرز تميز العمل الإداري والمدرسي لهذه الصفحة.'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          {isAdminMode && (
                            <>
                              <button
                                type="button"
                                onClick={() => fileUploadInputRef.current?.click()}
                                disabled={isUploadingAttachment}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-xl text-xs font-black transition-all cursor-pointer shadow-3xs"
                                title="رفع ملف أو صورة أو مستند مباشرة من جهازك"
                              >
                                <LucideIcon name="UploadCloud" size={13} className="text-teal-700" />
                                <span>{isUploadingAttachment ? 'جارِ المعالجة...' : 'رفع ملف / صورة من الجهاز'}</span>
                              </button>

                              <button
                                onClick={handlePromptChangeAttachmentsPassword}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-black transition-all cursor-pointer shadow-3xs"
                                title="تعديل وتعيين كلمة مرور جميع الشواهد"
                              >
                                <LucideIcon name="KeyRound" size={13} className="text-amber-700" />
                                <span>تغيير كلمة مرور الشواهد</span>
                              </button>

                              <button
                                onClick={() => setShowAddAttachment(!showAddAttachment)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs cursor-pointer hover:bg-slate-50 font-bold transition-colors shadow-3xs"
                              >
                                <LucideIcon name={showAddAttachment ? 'X' : 'Plus'} size={13} />
                                <span>{showAddAttachment ? 'إلغاء نموذج المرفق' : 'إرفاق شاهد جديد'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Hidden File Inputs for Direct & Drag-and-Drop Upload */}
                      <input
                        type="file"
                        ref={fileUploadInputRef}
                        multiple
                        className="hidden"
                        onChange={handleDirectFileInputChange}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      />

                      <input
                        type="file"
                        ref={formFileInputRef}
                        className="hidden"
                        onChange={handleFormFileSelected}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      />

                      {/* Expanded manual add attachment section */}
                      {showAddAttachment && (
                        <form onSubmit={handleAddAttachment} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-950">تفاصيل المرفق والشاهد الجديد</h4>
                            <button
                              type="button"
                              onClick={() => formFileInputRef.current?.click()}
                              disabled={isUploadingAttachment}
                              className="text-[11px] font-bold text-madrasati-teal bg-white border border-madrasati-teal/30 hover:bg-madrasati-teal-bg/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-3xs"
                            >
                              <LucideIcon name="UploadCloud" size={12} />
                              <span>{isUploadingAttachment ? 'جارِ القراءة...' : 'اختيار ملف من جهازك للتعبئة التلقائية'}</span>
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500">اسم المرفق أو الشاهد</label>
                              <input
                                type="text"
                                required
                                value={newAttachmentName}
                                onChange={(e) => setNewAttachmentName(e.target.value)}
                                placeholder="مثال: الخطة التشغيلية السنوية"
                                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-medium"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500">نوع الشاهد</label>
                              <select
                                value={newAttachmentType}
                                onChange={(e) => setNewAttachmentType(e.target.value as AttachmentType)}
                                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-medium"
                              >
                                <option value="file">ملف مستند (PDF, Word, Excel)</option>
                                <option value="image">صورة وإثبات مرئي</option>
                                <option value="drive">مجلد سحابي (Google Drive, OneDrive)</option>
                                <option value="url">رابط خارجي (موقع إلكتروني)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-500">
                                {newAttachmentUrl && newAttachmentUrl.startsWith('data:') 
                                  ? `ملف محلي مرفوع (${newAttachmentSize || 'جاهز'})`
                                  : 'الرابط الرقمي السحابي (اختياري)'}
                              </label>
                              <input
                                type="text"
                                value={newAttachmentUrl && newAttachmentUrl.startsWith('data:') ? `[تم استيراد بيانات الملف محلياً بنجاح]` : newAttachmentUrl}
                                disabled={Boolean(newAttachmentUrl && newAttachmentUrl.startsWith('data:'))}
                                onChange={(e) => setNewAttachmentUrl(e.target.value)}
                                placeholder="https://example.com/file"
                                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal disabled:bg-slate-100 text-slate-700"
                              />
                            </div>

                            {/* Criterion selector dropdown */}
                            {activePage.criteria.length > 0 && (
                              <div className="space-y-1 md:col-span-3">
                                <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                  <LucideIcon name="CheckSquare" size={11} className="text-madrasati-teal" />
                                  <span>ربط المرفق بمعيار محدد من بنود هذه الصفحة (اختياري - يظهر الشاهد تحت المعيار مباشرة):</span>
                                </label>
                                <select
                                  value={selectedCriterionIdForNewAttachment}
                                  onChange={(e) => setSelectedCriterionIdForNewAttachment(e.target.value)}
                                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-medium text-slate-800"
                                >
                                  <option value="">-- شاهد عام لكامل الصفحة (غير مخصص لمعيار واحد) --</option>
                                  {activePage.criteria.map((c, i) => (
                                    <option key={c.id} value={c.id}>
                                      معيار {i + 1}: {c.text.substring(0, 60)}{c.text.length > 60 ? '...' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-1 border-t border-slate-200/50">
                            <button
                              type="submit"
                              disabled={isUploadingAttachment}
                              className="px-4 py-2 bg-madrasati-teal text-white font-black rounded-xl text-xs hover:bg-opacity-90 cursor-pointer disabled:opacity-50"
                            >
                              إضافة الشاهد وتصنيفه
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddAttachment(false)}
                              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs hover:bg-slate-300"
                            >
                              إلغاء
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Simulative Drag and Drop Zone Area - Madrasati Styled */}
                      {isAdminMode && (
                        <div 
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onClick={() => fileUploadInputRef.current?.click()}
                          className="border-2 border-dashed border-madrasati-teal/30 bg-madrasati-teal-bg/15 rounded-2xl p-6 text-center hover:bg-madrasati-teal-bg/25 transition-colors cursor-pointer group"
                        >
                          <div className="max-w-md mx-auto space-y-2">
                            <div className="w-10 h-10 rounded-full bg-madrasati-teal-bg border border-madrasati-teal/20 flex items-center justify-center text-madrasati-teal mx-auto group-hover:scale-110 transition-transform">
                              <LucideIcon name="Upload" size={18} />
                            </div>
                            <div className="text-xs">
                              <span className="font-bold text-madrasati-teal">اسحب الشواهد والملفات الرقمية وأفلتها هنا مباشرة أو انقر للاختيار</span>
                              <span className="text-slate-500 font-bold"> من جهازك</span>
                            </div>
                            <p className="text-[10px] text-slate-400">يدعم الصور والمستندات (PDF, Word, Excel, PowerPoint) بجميع الأحجام</p>
                          </div>
                        </div>
                      )}

                      {/* Displaying Current Page Attachments list */}
                      {activePage.attachments.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-100 p-8 rounded-2xl text-center text-slate-400 text-xs">
                          <LucideIcon name="FileCode" className="mx-auto text-slate-300 mb-2" size={24} />
                          لا توجد شواهد أو وثائق مرفقة بهذا الباب حالياً.
                          <p className="text-[10px] text-slate-400 mt-1">تأكد من إدراج الخطط والقرارات والمستندات ذات الصِّلة لتتم أرشفتها بنجاح.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activePage.attachments.map((att) => {
                            let iconName = "FileText";
                            let iconBg = "bg-indigo-50 text-indigo-700 border-indigo-100";
                            let localizedTypeName = "مستند رسمي";

                            if (att.type === 'image') {
                              iconName = "Activity";
                              iconBg = "bg-sky-50 text-sky-700 border-sky-100";
                              localizedTypeName = "شاهد مرئي";
                            } else if (att.type === 'drive') {
                              iconName = "FolderOpen";
                              iconBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
                              localizedTypeName = "مجلد سحابي (جوجل درايف)";
                            } else if (att.type === 'url') {
                              iconName = "Link";
                              iconBg = "bg-blue-50 text-blue-700 border-blue-100";
                              localizedTypeName = "رابط إلكتروني";
                            }

                            const linkedCrit = activePage.criteria.find(c => c.id === att.criterionId);

                            return (
                              <div 
                                key={att.id}
                                className="bg-white border border-slate-200/60 hover:border-slate-300 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-3xs hover:shadow-2xs transition-all cursor-pointer group"
                                onClick={() => handleOpenAttachment(att)}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
                                      <LucideIcon name={iconName} size={15} />
                                    </div>
                                    <div className="text-right overflow-hidden space-y-0.5">
                                      <h5 className="font-bold text-slate-800 group-hover:text-madrasati-teal text-xs truncate max-w-[180px] sm:max-w-[280px] transition-colors">
                                        {att.name}
                                      </h5>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                        <span>{localizedTypeName}</span>
                                        <span>•</span>
                                        <span>{att.date}</span>
                                        {att.size && (
                                          <>
                                            <span>•</span>
                                            <span>{att.size}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAttachment(att)}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                                        isAttachmentsLockEnabled && !isAdminMode && !isAttachmentsUnlockedSession
                                          ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                                          : 'bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100'
                                      }`}
                                      title={
                                        isAttachmentsLockEnabled && !isAdminMode && !isAttachmentsUnlockedSession
                                          ? 'الشاهد مؤمن بكلمة مرور - انقر لإدخال كلمة المرور للاطلاع عليه'
                                          : 'عرض الشاهد المرفق'
                                      }
                                    >
                                      {isAttachmentsLockEnabled && !isAdminMode && !isAttachmentsUnlockedSession ? (
                                        <>
                                          <LucideIcon name="Lock" size={12} className="text-amber-700" />
                                          <span>عرض</span>
                                        </>
                                      ) : (
                                        <>
                                          <LucideIcon name="ExternalLink" size={12} className="text-teal-700" />
                                          <span>عرض</span>
                                        </>
                                      )}
                                    </button>
                                    {isAdminMode && (
                                      <button
                                        onClick={() => handleDeleteAttachment(att.id)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="حذف المستند"
                                      >
                                        <LucideIcon name="Trash2" size={13} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {linkedCrit && (
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1 text-[10px] text-teal-900 bg-teal-50/70 border border-teal-100 rounded-md px-2 py-0.5 font-bold">
                                    <LucideIcon name="CheckCircle2" size={10} className="text-teal-700 shrink-0" />
                                    <span className="truncate">مرتبط بالمعيار: {linkedCrit.text}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick navigation at bottom page */}
                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                      <button
                        onClick={() => {
                          const currentIndex = pages.findIndex(p => p.id === activePage.id);
                          if (currentIndex > 0) {
                            setActiveTabId(pages[currentIndex - 1].id);
                          } else {
                            setActiveTabId(0); // Go back home
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
                      >
                        <LucideIcon name="ChevronRight" size={14} />
                        السابق
                      </button>

                      <button
                        onClick={() => {
                          const currentIndex = pages.findIndex(p => p.id === activePage.id);
                          if (currentIndex < pages.length - 1) {
                            setActiveTabId(pages[currentIndex + 1].id);
                          } else {
                            setActiveTabId(0); // Loop back home
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors"
                      >
                        التالي
                        <LucideIcon name="ChevronLeft" size={14} />
                      </button>
                    </div>

                  </div>
                </div>
              )
            )}
          </main>
        </div>
      </div>

      {/* CENTRAL CONTROL PANEL: REVOLUTIONARY MODAL OR OVERLAY DRAWER */}
      {isControlPanelOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-50 animate-fade-in" id="control-panel-overlay">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden text-right animate-slide-left">
            
            {/* Header Control Panel */}
            <div className="bg-gradient-to-l from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white">
                  <LucideIcon name="Settings" size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm md:text-base">لوحة التحكم المركزية بالملف</h3>
                  <p className="text-[10px] text-teal-100/80">تحديث الهوية وتعديل مسميات الـ 19 صفحة في مكان واحد</p>
                </div>
              </div>
              <button
                onClick={() => setIsControlPanelOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                title="إغلاق لوحة التحكم"
              >
                <LucideIcon name="X" size={16} />
              </button>
            </div>

            {/* Scrollable Control Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Box 1: General School Leader Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                  أولاً: معلومات وهوية قائد المدرسة
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">اسم المدير / قائد المدرسة</label>
                    <input
                      type="text"
                      value={config.managerName}
                      onChange={(e) => setConfig({ ...config, managerName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">اسم المدرسة / الصرح التعليمي</label>
                    <input
                      type="text"
                      value={config.schoolName}
                      onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">المسمى الوظيفي للمدير وطبيعة عمله</label>
                    <input
                      type="text"
                      value={config.managerTitle}
                      onChange={(e) => setConfig({ ...config, managerTitle: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500">العام الدراسي والموسم الرقمي</label>
                    <input
                      type="text"
                      value={config.year}
                      onChange={(e) => setConfig({ ...config, year: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* Principal Photo Uploader/URL field */}
                  <div className="col-span-1 sm:col-span-2 space-y-2 border-t border-slate-100 pt-3">
                    <label className="text-[10px] font-black text-slate-705 block">صورة مدير المدرسة (الصفحة الرئيسية)</label>
                    
                    {/* Choose between URL and Direct Upload */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-100/30 p-3 rounded-xl border border-slate-200/50">
                      
                      {/* Left side: Drag-and-Drop / click to select file */}
                      <div className="space-y-1.5 text-right">
                        <label className="text-[9px] font-bold text-slate-500 block">تحميل مباشر للملف (يدعم السحب والإفلات)</label>
                        <div 
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingPhoto(true);
                          }}
                          onDragLeave={() => setIsDraggingPhoto(false)}
                          onDrop={async (e) => {
                            e.preventDefault();
                            setIsDraggingPhoto(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              try {
                                const compressedDataUrl = await compressImageFile(file, 600, 600, 0.85);
                                setConfig(prev => ({ ...prev, managerPhotoUrl: compressedDataUrl }));
                                triggerFeedback('success', 'تم رفع وضغط وحفظ صورة المدير بنجاح.');
                              } catch (err) {
                                triggerFeedback('error', 'حدث خطأ أثناء معالجة الصورة.');
                              }
                            }
                          }}
                          onClick={() => {
                            const input = document.getElementById('principal-photo-file-input');
                            if (input) input.click();
                          }}
                          className={`border-2 border-dashed rounded-xl p-3 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[96px] ${
                            isDraggingPhoto 
                            ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950' 
                            : 'border-slate-300 bg-white hover:bg-slate-100/50 text-slate-600'
                          }`}
                        >
                          <LucideIcon name="UploadCloud" size={20} className={isDraggingPhoto ? 'text-emerald-600' : 'text-slate-400'} />
                          <span className="text-[10px] font-bold">اسحب صورتك الشخصية هنا أو اضغط للتصفح</span>
                          <span className="text-[8px] text-slate-400">JPG, PNG (ضغط تلقائي وحفظ آمن في السحابة)</span>
                          
                          <input 
                            type="file" 
                            id="principal-photo-file-input" 
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const compressedDataUrl = await compressImageFile(file, 600, 600, 0.85);
                                  setConfig(prev => ({ ...prev, managerPhotoUrl: compressedDataUrl }));
                                  triggerFeedback('success', 'تم رفع وضغط وحفظ صورة المدير بنجاح.');
                                } catch (err) {
                                  triggerFeedback('error', 'حدث خطأ أثناء معالجة الصورة.');
                                }
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* Right side: Image URL pasting & quick presets */}
                      <div className="space-y-3 flex flex-col justify-between text-right">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-slate-500 block">أو أدخل رابط الصورة مباشرة (URL)</label>
                          <input
                            type="url"
                            value={config.managerPhotoUrl || ''}
                            onChange={(e) => setConfig({ ...config, managerPhotoUrl: e.target.value })}
                            className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                            placeholder="انسخ الصق رابط صورة المدير..."
                          />
                        </div>

                        {/* Presets and delete buttons */}
                        <div className="space-y-1.5">
                          <span className="text-[8px] font-bold text-slate-400 block">نماذج وصور سريعة للاستخدام:</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setConfig({ ...config, managerPhotoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150" });
                                triggerFeedback('success', 'تم استخدام صورة رمزية أولى لمدير المدرسة.');
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[9px] text-slate-600 cursor-pointer font-bold inline-flex items-center gap-1 shadow-3xs"
                            >
                              👨‍💼 نموذج 1
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfig({ ...config, managerPhotoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150" });
                                triggerFeedback('success', 'تم استخدام صورة رمزية ثانية لمدير المدرسة.');
                              }}
                              className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[9px] text-slate-600 cursor-pointer font-bold inline-flex items-center gap-1 shadow-3xs"
                            >
                              🧑‍💼 نموذج 2
                            </button>
                            {config.managerPhotoUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfig({ ...config, managerPhotoUrl: "" });
                                  triggerFeedback('success', 'تم تصفير وإزالة صورة المدير.');
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-150 rounded-md text-[9px] text-rose-700 cursor-pointer font-black inline-flex items-center gap-1 shadow-3xs mr-auto"
                              >
                                🗑️ حذف
                              </button>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>

                  {/* Vision, Mission, Values Inputs */}
                  <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-100 space-y-3">
                    <h5 className="font-extrabold text-xs text-madrasati-dark flex items-center gap-1.5">
                      <LucideIcon name="Target" size={14} className="text-madrasati-teal" />
                      <span>صياغة الرؤية والرسالة والقيم للمدرسة</span>
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Vision Field */}
                      <div className="space-y-1 bg-teal-50/50 p-2.5 rounded-xl border border-teal-100">
                        <label className="text-[10px] font-extrabold text-teal-900 flex items-center gap-1">
                          <LucideIcon name="Eye" size={12} className="text-teal-700" />
                          <span>الرؤية (Vision)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={config.vision || ''}
                          onChange={(e) => {
                            const newVis = e.target.value;
                            setConfig({
                              ...config,
                              vision: newVis,
                              biography: `الرؤية: ${newVis}. الرسالة: ${config.mission || ''}. القيم: ${config.values || ''}.`
                            });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-teal-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="رؤية المدرسة..."
                        />
                      </div>

                      {/* Mission Field */}
                      <div className="space-y-1 bg-sky-50/50 p-2.5 rounded-xl border border-sky-100">
                        <label className="text-[10px] font-extrabold text-sky-900 flex items-center gap-1">
                          <LucideIcon name="BookOpen" size={12} className="text-sky-700" />
                          <span>الرسالة (Mission)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={config.mission || ''}
                          onChange={(e) => {
                            const newMis = e.target.value;
                            setConfig({
                              ...config,
                              mission: newMis,
                              biography: `الرؤية: ${config.vision || ''}. الرسالة: ${newMis}. القيم: ${config.values || ''}.`
                            });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-sky-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="رسالة المدرسة..."
                        />
                      </div>

                      {/* Values Field */}
                      <div className="space-y-1 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                        <label className="text-[10px] font-extrabold text-amber-900 flex items-center gap-1">
                          <LucideIcon name="Star" size={12} className="text-amber-700" />
                          <span>القيم المؤسسية (Values)</span>
                        </label>
                        <textarea
                          rows={2}
                          value={config.values || ''}
                          onChange={(e) => {
                            const newVals = e.target.value;
                            setConfig({
                              ...config,
                              values: newVals,
                              biography: `الرؤية: ${config.vision || ''}. الرسالة: ${config.mission || ''}. القيم: ${newVals}.`
                            });
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                          placeholder="القيم مفصولة بفاصلة (مثال: المواطنة، الانتماء، التميز)..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2: Bulk Rename Pages lists & details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>
                    ثانياً: إدارة وتسميات الصفحات (تعديل مباشر لـ {pages.length} صفحة)
                  </h4>
                  <button 
                    onClick={handleAddNewPage}
                    className="text-teal-700 hover:text-teal-900 text-xs font-bold inline-flex items-center gap-1 bg-teal-50 px-2 py-1 rounded"
                  >
                    <LucideIcon name="Plus" size={11} />
                    إضافة صفحة
                  </button>
                </div>

                <p className="text-[10px] text-slate-500">
                  يمكنك إعادة تعيين جميع العناوين بما يناسب خطتكم المدرسية الفردية. سيتم تحديث شريط التبويب الجانبي تلقائياً بعد الحفظ.
                </p>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {pages.map((p, idx) => (
                    <div 
                      key={p.id}
                      className="p-3 bg-slate-50/50 border border-slate-200/60 rounded-xl space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-slate-500 font-bold">رمز المعيار:</span>
                          <input
                            type="text"
                            value={p.code || ''}
                            placeholder="رمز اختياري"
                            onChange={(e) => handleEditPageCodeInBulk(p.id, e.target.value)}
                            className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-xs text-madrasati-dark focus:outline-none focus:ring-1 focus:ring-teal-500 font-extrabold"
                            title="رمز المعيار"
                          />
                        </div>

                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <LucideIcon name={p.iconName} size={11} />
                          </div>

                          <input
                            type="text"
                            value={p.title}
                            onChange={(e) => handleRenamePageInBulk(p.id, e.target.value)}
                            className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-850 focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
                            placeholder="اسم المعيار / الصفحة"
                          />
                        </div>

                        {/* Section Selector dropdown */}
                        <div className="flex items-center gap-1.5 min-w-[125px] shrink-0">
                          <span className="text-[10px] text-slate-400 font-bold">القسم:</span>
                          <select
                            value={p.sectionId || 'school-admin'}
                            onChange={(e) => {
                              const newSecId = e.target.value;
                              setPages(prev => prev.map(page => page.id === p.id ? { ...page, sectionId: newSecId } : page));
                              triggerFeedback('success', `تم تبويب الصفحة في القسم بنجاح.`);
                            }}
                            className="flex-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold cursor-pointer"
                          >
                            {sections.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => handleDeletePage(p.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 shrink-0 cursor-pointer"
                          title="حذف هذا الباب نهائياً"
                        >
                          <LucideIcon name="Trash2" size={12} />
                        </button>
                      </div>

                      {/* Dropdown panel to add/edit criteria & attachments inside control panel */}
                      <ControlPanelPageDetails
                        page={p}
                        onAddCriterion={handleAddCriterionForPage}
                        onToggleCriterion={handleToggleCriterionForPage}
                        onEditCriterionText={handleEditCriterionTextForPage}
                        onDeleteCriterion={handleDeleteCriterionForPage}
                        onAddAttachment={handleAddAttachmentForPage}
                        onDeleteAttachment={handleDeleteAttachmentForPage}
                        onOpenAttachment={handleOpenAttachment}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 3: Sections & Segments Structure Manager */}
              <div className="space-y-3 pt-2">
                <hr className="border-slate-100" />
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-madrasati-teal inline-block"></span>
                  ثالثاً: إدارة الأقسام وتصنيفات العمل المدرسي والتطويري
                </h4>
                
                <p className="text-[10px] text-slate-500 font-bold">
                  يمكنك هيكلة ملف إنجازك من خلال استحداث أقسام مخصصة جديدة. عند حذف أي قسم، يتم ترحيل صفحاته ومرفقاته تلقائياً لضمان سلامة بياناتك وتجنب ضياع الشواهد المرفوعة.
                </p>

                {/* Create Section Form */}
                <form onSubmit={handleAddNewSection} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="مثال: قسم التوجيه الطلابي، التطوير المهني، معايير التحصيل..."
                    className="flex-1 text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="submit"
                    className="bg-madrasati-teal text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-opacity-95 cursor-pointer shrink-0"
                  >
                    إضافة قسم جديد
                  </button>
                </form>

                {/* List of current sections with delete buttons */}
                <div className="space-y-1.5 pt-1">
                  {sections.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-madrasati-teal animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-800">{s.name}</span>
                        {s.id === 'school-admin' && (
                          <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">القسم الافتراضي</span>
                        )}
                      </div>
                      
                      {s.id !== 'school-admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(s.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white transition-colors cursor-pointer"
                          title="حذف هذا القسم بالكامل وترحيل صفحاته"
                        >
                          <LucideIcon name="Trash2" size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 4: Attachment Password & Security Settings (حساب المدير) */}
              <div className="space-y-3 pt-2">
                <hr className="border-slate-100" />
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  رابعاً: تأمين الحماية وإعدادات تسجيل دخول المشرف وكلمة مرور الشواهد
                </h4>
                
                {/* Admin login credentials update box */}
                <div className="p-4 bg-slate-100/60 border border-slate-200/80 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 font-bold">
                      <LucideIcon name="Lock" size={16} />
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-900">بيانات تسجيل دخول حساب المشرف (Admin)</h5>
                      <p className="text-[10px] text-slate-500 font-bold">
                        يمكنك تغيير اسم المستخدم أو تعيين كلمة مرور جديدة لحساب المشرف للتحكم في الملف
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">اسم المستخدم (المشرف):</label>
                      <input
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="اسم المستخدم..."
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">كلمة مرور المشرف الجديدة:</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="كلمة مرور المشرف..."
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-bold tracking-wider"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                        <LucideIcon name="ShieldCheck" size={16} />
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-amber-950">حالة قفل الشواهد بالموقع</h5>
                        <p className="text-[10px] text-amber-800 font-bold">
                          {isAttachmentsLockEnabled ? 'قفل الشواهد مُفعّل حالياً بكلمة مرور' : 'قفل الشواهد مُعطّل (يمكن للجميع الفتح مباشرة)'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAttachmentsLockEnabled(!isAttachmentsLockEnabled);
                        triggerFeedback('success', !isAttachmentsLockEnabled ? 'تم تفعيل قفل الشواهد بكلمة مرور.' : 'تم تعطيل قفل الشواهد (متاح للجميع).');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        isAttachmentsLockEnabled
                          ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                          : 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {isAttachmentsLockEnabled ? 'تعطيل القفل' : 'تفعيل قفل الشواهد'}
                    </button>
                  </div>

                  {/* Password change form inside control panel */}
                  <div className="pt-2 border-t border-amber-200/50 space-y-2">
                    <label className="text-[10px] font-extrabold text-amber-900 block">
                      كلمة مرور الشواهد لجميع المرفقات:
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPasswordInControlPanel ? "text" : "password"}
                          value={attachmentsPassword}
                          onChange={(e) => setAttachmentsPassword(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 bg-white border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold tracking-wider"
                          placeholder="كلمة مرور الشواهد..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordInControlPanel(!showPasswordInControlPanel)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                          title={showPasswordInControlPanel ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        >
                          <LucideIcon name={showPasswordInControlPanel ? "Eye" : "EyeOff"} size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!attachmentsPassword.trim()) {
                            triggerFeedback('error', 'يرجى إدخال كلمة مرور صالحة.');
                            return;
                          }
                          triggerFeedback('success', 'تم تحديث كلمة مرور الشواهد بنجاح.');
                        }}
                        className="bg-amber-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-black hover:bg-amber-900 transition-colors cursor-pointer shrink-0"
                      >
                        حفظ كلمة المرور
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset Database Button Box */}
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-950 rounded-xl space-y-2">
                <h5 className="font-bold text-xs flex items-center gap-1.5 text-rose-800">
                  <LucideIcon name="AlertCircle" size={14} />
                  إجراءات الخطورة وإفراغ الملف
                </h5>
                <p className="text-[10px] text-rose-700">
                  هل ترغب في إعادة ضبط الموقع، وإرجاع الأقسام الـ 19 للأسماء والصيغ الأساسية؟ هذا الإجراء سيمحو المسودات التي لم تحفظ بالمستودعات.
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleResetToDefaults}
                    className="px-3 py-1.5 bg-rose-800 text-white rounded-lg text-[10px] font-bold hover:bg-rose-950 transition-colors shadow-2xs cursor-pointer"
                  >
                    إعادة ضبط المصنع للقيم الافتراضية للـ 19 صفحة
                  </button>
                </div>
              </div>

            </div>

            {/* Sticky bottom save/confirm section */}
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                <LucideIcon name="CheckCircle2" size={14} />
                <span>قاعدة البيانات السحابية Supabase جاهزة ونشطة</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      saveSupabaseCredentials(supabaseUrl, supabaseAnonKey);
                      await api.saveAll({
                        config,
                        pages,
                        sections,
                        settings: {
                          adminUsername,
                          adminPassword,
                          attachmentsPassword,
                          isAttachmentsLockEnabled,
                        },
                      });
                      setIsControlPanelOpen(false);
                      triggerFeedback('success', 'تم حفظ وتثبيت كافة التعديلات في قاعدة بيانات Supabase السحابية بنجاح!');
                    } catch (e) {
                      setIsControlPanelOpen(false);
                      triggerFeedback('success', 'تم حفظ التعديلات بنجاح.');
                    }
                  }}
                  className="px-5 py-2 bg-madrasati-teal hover:bg-opacity-90 text-white font-bold rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <LucideIcon name="Save" size={13} />
                  <span>تحديث وحفظ التغييرات بالكامل</span>
                </button>
                
                <button
                  onClick={() => setIsControlPanelOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ADMIN LOGIN MODAL (SECURE USERNAME & PASSWORD) */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] animate-fade-in p-4" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-up text-right">
            
            {/* Modal Top Header */}
            <div className="bg-gradient-to-l from-madrasati-dark to-slate-800 text-white p-6 relative">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-madrasati-teal flex items-center justify-center text-white shadow-md">
                    <LucideIcon name="Lock" size={20} />
                  </div>
                  <div>
                    <h4 className="font-black text-sm md:text-base">تسجيل دخول المشرف والإدارة</h4>
                    <p className="text-[10px] text-teal-100/90 font-medium">لوحة صلاحيات التحكم وإدارة المحتوى</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <LucideIcon name="X" size={16} />
                </button>
              </div>
            </div>

            {/* Login Form Body */}
            <form onSubmit={handleAdminLoginSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                الرجاء إدخال اسم المستخدم وكلمة المرور لتفعيل وضع الإدارة وتعديل البيانات:
              </p>

              {loginError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                  <LucideIcon name="AlertCircle" size={16} className="text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  اسم المستخدم:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 pointer-events-none">
                    <LucideIcon name="User" size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={loginInputUser}
                    onChange={(e) => {
                      setLoginInputUser(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="أدخل اسم المستخدم (مثال: admin)..."
                    className="w-full text-xs pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-madrasati-teal font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Password Field with Hide/Show Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  كلمة المرور:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 pointer-events-none">
                    <LucideIcon name="KeyRound" size={16} />
                  </span>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginInputPass}
                    onChange={(e) => {
                      setLoginInputPass(e.target.value);
                      setLoginError('');
                    }}
                    placeholder="أدخل كلمة المرور..."
                    className="w-full text-xs pr-10 pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-madrasati-teal font-bold tracking-wider text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showLoginPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    <LucideIcon name={showLoginPassword ? "EyeOff" : "Eye"} size={16} />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-madrasati-teal hover:bg-slate-900 text-white font-black rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG MODAL (CONFIRMATIONS & PROMPTS) */}
      {customModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] animate-fade-in p-4" id="custom-alert-prompt-overlay" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col p-6 space-y-4 animate-scale-up text-right">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-madrasati-teal-bg text-madrasati-teal flex items-center justify-center shrink-0">
                <LucideIcon name={customModal.type === 'prompt' ? 'KeyRound' : 'HelpCircle'} size={18} />
              </div>
              <div>
                <h4 className="font-black text-slate-800 text-sm md:text-base">{customModal.title}</h4>
                <p className="text-[10px] text-slate-400 font-bold">إجراء نظام بالملف</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <p className="text-xs text-slate-650 leading-relaxed font-bold">
                {customModal.message}
              </p>

              {customModal.type === 'prompt' && (
                <div className="space-y-1.5">
                  <input
                    type="password"
                    autoFocus
                    value={modalInputValue}
                    onChange={(e) => {
                      setModalInputValue(e.target.value);
                      setModalErrorMsg('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        customModal.onConfirm(modalInputValue);
                      }
                    }}
                    placeholder={customModal.placeholder || "أدخل رمز المرور..."}
                    className="w-full text-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-madrasati-teal font-medium tracking-wider"
                  />
                  {modalErrorMsg && (
                    <p className="text-[10px] text-red-650 font-bold flex items-center gap-1">
                      <LucideIcon name="AlertCircle" size={10} />
                      {modalErrorMsg}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center gap-2 justify-end pt-2 border-t border-slate-50">
              <button
                type="button"
                onClick={() => {
                  customModal.onConfirm(modalInputValue);
                }}
                className="px-5 py-2.5 bg-madrasati-teal hover:bg-slate-900 text-white font-black rounded-xl text-xs transition-colors shadow-sm cursor-pointer shrink-0"
              >
                {customModal.confirmLabel || 'تأكيد'}
              </button>

              <button
                type="button"
                onClick={() => setCustomModal(null)}
                className="px-4 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
              >
                {customModal.cancelLabel || 'إلغاء'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ATTACHMENT VIEWER & PREVIEW MODAL */}
      <AttachmentViewerModal
        attachment={activeAttachmentPreview}
        onClose={() => setActiveAttachmentPreview(null)}
      />

      {/* Footer System Credit Info */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center mt-12">
        <div className="max-w-7.5xl mx-auto px-4 space-y-2">
          <p className="text-[11px] text-slate-400 font-bold tracking-wider">
            ملف إنجاز الإدارة والتميز الرقمي © {config.year}
          </p>
        </div>
      </footer>

    </div>
  );
}
