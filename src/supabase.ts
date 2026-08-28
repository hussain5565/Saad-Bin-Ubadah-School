import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PortfolioConfig, PortfolioPage, PortfolioSection } from './types';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './supabaseConfig';

export interface AppSecuritySettings {
  adminUsername: string;
  adminPassword: string;
  attachmentsPassword: string;
  isAttachmentsLockEnabled: boolean;
}

export interface SupabasePortfolioData {
  config?: PortfolioConfig;
  pages?: PortfolioPage[];
  sections?: PortfolioSection[];
  settings?: AppSecuritySettings;
}

// 1. Get Supabase Credentials from (URL Params -> LocalStorage -> Vite Env -> supabaseConfig.ts)
export function getSupabaseCredentials() {
  let urlFromParams = '';
  let keyFromParams = '';

  // Check URL parameters for instant cross-device connection (?sb_url=...&sb_key=...)
  if (typeof window !== 'undefined') {
    try {
      const urlObj = new URL(window.location.href);
      const paramUrl = urlObj.searchParams.get('sb_url');
      const paramKey = urlObj.searchParams.get('sb_key');
      if (paramUrl && paramKey) {
        urlFromParams = decodeURIComponent(paramUrl).trim();
        keyFromParams = decodeURIComponent(paramKey).trim();
        // Persist to localStorage
        localStorage.setItem('portfolio_supabase_url', urlFromParams);
        localStorage.setItem('portfolio_supabase_anon_key', keyFromParams);
        // Clean URL to prevent clutter without reloading
        urlObj.searchParams.delete('sb_url');
        urlObj.searchParams.delete('sb_key');
        window.history.replaceState({}, '', urlObj.pathname + (urlObj.search ? urlObj.search : '') + urlObj.hash);
      }
    } catch {
      // Ignore
    }
  }

  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('portfolio_supabase_url') || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('portfolio_supabase_anon_key') || '' : '';

  let url = (urlFromParams || storedUrl || envUrl || DEFAULT_SUPABASE_URL || '').trim();
  let anonKey = (keyFromParams || storedKey || envKey || DEFAULT_SUPABASE_ANON_KEY || '').trim();

  // Clean trailing slashes from URL
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  return { url, anonKey, isConfigured: Boolean(url && anonKey) };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    const cleanKey = anonKey.trim();

    localStorage.setItem('portfolio_supabase_url', cleanUrl);
    localStorage.setItem('portfolio_supabase_anon_key', cleanKey);
    // Reset cache so subsequent calls use new client
    cachedClient = null;
    lastUrl = '';
    lastKey = '';
  }
}

export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('portfolio_supabase_url');
    localStorage.removeItem('portfolio_supabase_anon_key');
    cachedClient = null;
    lastUrl = '';
    lastKey = '';
  }
}

// Generate shareable link to open on any device with automatic Supabase connection
export function generateCrossDeviceSyncLink(): string {
  if (typeof window === 'undefined') return '';
  const { url, anonKey, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return window.location.origin + window.location.pathname;

  const urlObj = new URL(window.location.origin + window.location.pathname);
  urlObj.searchParams.set('sb_url', url);
  urlObj.searchParams.set('sb_key', anonKey);
  return urlObj.toString();
}

// 2. Initialize Supabase Client instance (singleton / dynamic)
let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  if (cachedClient && lastUrl === url && lastKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    lastUrl = url;
    lastKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.warn('Error creating Supabase client:', err);
    return null;
  }
}

// SQL Script Schema for Supabase Setup
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- جدول حفظ بيانات ملف إنجاز المدرسة الشامل (Supabase)
-- انسخ هذا الكود بالكامل والصقه في SQL Editor داخل Supabase واضغط RUN
-- ========================================================

CREATE TABLE IF NOT EXISTS public.portfolio_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- تعطيل قيود RLS للسماح بالقراءة والكتابة السريعة بالمفتاح العام
ALTER TABLE public.portfolio_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access" ON public.portfolio_store;
CREATE POLICY "Allow public full access"
ON public.portfolio_store
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
`;

// 3. Supabase Operations
export const supabaseDb = {
  isConfigured(): boolean {
    return getSupabaseCredentials().isConfigured;
  },

  // Check if Supabase connection is working
  async checkConnection(): Promise<{ ok: boolean; message: string; needTable?: boolean }> {
    const { isConfigured, url } = getSupabaseCredentials();
    if (!isConfigured) {
      return { ok: false, message: 'بيانات الربط مع Supabase (الرابط والمفتاح) فارغة. يرجى إدخالها أولاً.' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { ok: false, message: 'رابط مشروع Supabase غير صحيح. يجب أن يبدأ بـ https://' };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { ok: false, message: 'تعذر إنشاء عميل الاتصال بـ Supabase. تحقق من صحة المفتاح والرابط.' };
    }

    try {
      const { data, error } = await client
        .from('portfolio_store')
        .select('key')
        .limit(1);

      if (error) {
        if (
          error.code === '42P01' ||
          error.code === 'PGRST204' ||
          error.message?.toLowerCase().includes('does not exist') ||
          error.message?.toLowerCase().includes('relation') ||
          error.message?.toLowerCase().includes('could not find the table')
        ) {
          return {
            ok: false,
            needTable: true,
            message: 'جدول portfolio_store غير موجود في قاعدة بيانات Supabase. يرجى تنفيذ كود SQL الموضح أدناه لإنشائه.',
          };
        }

        if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied') || error.message?.toLowerCase().includes('violates row-level security')) {
          return {
            ok: false,
            needTable: true,
            message: 'سياسة الأمان (RLS) تمنع الوصول. يرجى تنفيذ كود SQL الموضح أدناه لتفعيل صلاحية الوصول.',
          };
        }

        return { ok: false, message: `تعذر الاتصال بـ Supabase: ${error.message} (رمز الخطأ: ${error.code || 'غير محدد'})` };
      }

      return { ok: true, message: 'الاتصال بقاعدة بيانات Supabase يعمل بنجاح والجدول متصل وجاهز!' };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'خطأ في الاتصال بالشبكة أو عنوان Supabase.' };
    }
  },

  // Fetch all portfolio data from Supabase
  async fetchAll(): Promise<SupabasePortfolioData | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('portfolio_store')
        .select('key, value');

      if (error || !data || data.length === 0) {
        return null;
      }

      const result: SupabasePortfolioData = {};
      for (const row of data) {
        if (row.key === 'config') result.config = row.value as PortfolioConfig;
        if (row.key === 'pages') result.pages = row.value as PortfolioPage[];
        if (row.key === 'sections') result.sections = row.value as PortfolioSection[];
        if (row.key === 'settings') result.settings = row.value as AppSecuritySettings;
      }

      return result;
    } catch (err) {
      console.warn('Supabase fetchAll note:', err);
      return null;
    }
  },

  // Save specific item to Supabase (upsert)
  async saveItem(key: 'config' | 'pages' | 'sections' | 'settings', value: any): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('portfolio_store')
        .upsert(
          {
            key,
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.warn(`Supabase upsert failed for ${key}:`, error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`Supabase saveItem exception for ${key}:`, err);
      return false;
    }
  },

  // Batch save everything
  async saveAll(data: SupabasePortfolioData): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'بيانات الاتصال بـ Supabase غير مهيأة بعد.' };
    }

    const rows: { key: string; value: any; updated_at: string }[] = [];
    const now = new Date().toISOString();

    if (data.config) rows.push({ key: 'config', value: data.config, updated_at: now });
    if (data.pages) rows.push({ key: 'pages', value: data.pages, updated_at: now });
    if (data.sections) rows.push({ key: 'sections', value: data.sections, updated_at: now });
    if (data.settings) rows.push({ key: 'settings', value: data.settings, updated_at: now });

    if (rows.length === 0) return { success: true };

    try {
      const { error } = await client
        .from('portfolio_store')
        .upsert(rows, { onConflict: 'key' });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ أثناء المزامنة' };
    }
  },
};
