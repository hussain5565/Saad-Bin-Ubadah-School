import { PortfolioConfig, PortfolioPage, PortfolioSection } from './types';
import { supabaseDb, AppSecuritySettings, SupabasePortfolioData } from './supabase';

export const api = {
  // Check if running on localhost or with local Express backend
  isLocalBackendAvailable: true,

  // Load All data (Supabase preferred -> fallback to Express API if available)
  async loadAll(): Promise<SupabasePortfolioData | null> {
    // 1. Try Supabase first if configured
    if (supabaseDb.isConfigured()) {
      try {
        const supabaseData = await supabaseDb.fetchAll();
        if (supabaseData && (supabaseData.config || supabaseData.pages || supabaseData.sections || supabaseData.settings)) {
          return supabaseData;
        }
      } catch {
        // Continue to fallback
      }
    }

    // 2. Try Express API as fallback only if not in pure static mode
    try {
      const [config, pages] = await Promise.all([
        this.getConfig(),
        this.getPages(),
      ]);

      if (config || (pages && pages.length > 0)) {
        return {
          config: config || undefined,
          pages: pages || undefined,
        };
      }
    } catch {
      // Ignore
    }

    return null;
  },

  // Save All data across Supabase & Express API
  async saveAll(data: SupabasePortfolioData): Promise<{ success: boolean; error?: string }> {
    // 1. Save to Supabase if configured
    if (supabaseDb.isConfigured()) {
      const supaResult = await supabaseDb.saveAll(data);
      if (!supaResult.success) {
        return supaResult;
      }
    }

    // 2. Also sync to Express API if available in local development
    if (this.isLocalBackendAvailable) {
      if (data.config) {
        this.saveConfig(data.config).catch(() => {});
      }
      if (data.pages) {
        this.savePages(data.pages).catch(() => {});
      }
    }

    return { success: true };
  },

  // Config
  async getConfig(): Promise<PortfolioConfig | null> {
    // Try Supabase first
    if (supabaseDb.isConfigured()) {
      const supaData = await supabaseDb.fetchAll();
      if (supaData?.config) return supaData.config;
    }

    // Fallback to local Express API
    if (!this.isLocalBackendAvailable) return null;
    try {
      const res = await fetch('/api/config');
      if (!res.ok) {
        if (res.status === 405 || res.status === 404) {
          this.isLocalBackendAvailable = false;
        }
        return null;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        this.isLocalBackendAvailable = false;
        return null;
      }
      return await res.json();
    } catch {
      this.isLocalBackendAvailable = false;
      return null;
    }
  },

  async saveConfig(config: PortfolioConfig): Promise<boolean> {
    // 1. Supabase
    if (supabaseDb.isConfigured()) {
      await supabaseDb.saveItem('config', config);
    }

    // 2. Local Express API
    if (!this.isLocalBackendAvailable) return true;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        if (res.status === 405 || res.status === 404) {
          this.isLocalBackendAvailable = false;
        }
      }
      return res.ok;
    } catch {
      this.isLocalBackendAvailable = false;
      return true;
    }
  },

  // Pages
  async getPages(): Promise<PortfolioPage[] | null> {
    // Try Supabase first
    if (supabaseDb.isConfigured()) {
      const supaData = await supabaseDb.fetchAll();
      if (supaData?.pages && supaData.pages.length > 0) return supaData.pages;
    }

    // Fallback to Express API
    if (!this.isLocalBackendAvailable) return null;
    try {
      const res = await fetch('/api/pages');
      if (!res.ok) {
        if (res.status === 405 || res.status === 404) {
          this.isLocalBackendAvailable = false;
        }
        return null;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        this.isLocalBackendAvailable = false;
        return null;
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
      return null;
    } catch {
      this.isLocalBackendAvailable = false;
      return null;
    }
  },

  async savePages(pages: PortfolioPage[]): Promise<boolean> {
    // 1. Supabase
    if (supabaseDb.isConfigured()) {
      await supabaseDb.saveItem('pages', pages);
    }

    // 2. Express API
    if (!this.isLocalBackendAvailable) return true;
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pages),
      });
      if (!res.ok) {
        if (res.status === 405 || res.status === 404) {
          this.isLocalBackendAvailable = false;
        }
      }
      return res.ok;
    } catch {
      this.isLocalBackendAvailable = false;
      return true;
    }
  },

  // Sections
  async getSections(): Promise<PortfolioSection[] | null> {
    if (supabaseDb.isConfigured()) {
      const supaData = await supabaseDb.fetchAll();
      return supaData?.sections || null;
    }
    return null;
  },

  async saveSections(sections: PortfolioSection[]): Promise<boolean> {
    if (supabaseDb.isConfigured()) {
      return await supabaseDb.saveItem('sections', sections);
    }
    return true;
  },

  // Security Settings
  async getSettings(): Promise<AppSecuritySettings | null> {
    if (supabaseDb.isConfigured()) {
      const supaData = await supabaseDb.fetchAll();
      return supaData?.settings || null;
    }
    return null;
  },

  async saveSettings(settings: AppSecuritySettings): Promise<boolean> {
    if (supabaseDb.isConfigured()) {
      return await supabaseDb.saveItem('settings', settings);
    }
    return true;
  }
};
