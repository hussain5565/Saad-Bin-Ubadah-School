import { PortfolioConfig, PortfolioPage } from './types';

export const api = {
  async getConfig(): Promise<PortfolioConfig | null> {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Could not fetch config from database API:', e);
      return null;
    }
  },

  async saveConfig(config: PortfolioConfig): Promise<boolean> {
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      return res.ok;
    } catch (e) {
      console.error('Could not save config to database API:', e);
      return false;
    }
  },

  async getPages(): Promise<PortfolioPage[] | null> {
    try {
      const res = await fetch('/api/pages');
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
      return null;
    } catch (e) {
      console.warn('Could not fetch pages from database API:', e);
      return null;
    }
  },

  async savePages(pages: PortfolioPage[]): Promise<boolean> {
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pages),
      });
      return res.ok;
    } catch (e) {
      console.error('Could not save pages to database API:', e);
      return false;
    }
  },

  async savePage(page: PortfolioPage): Promise<boolean> {
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      });
      return res.ok;
    } catch (e) {
      console.error(`Could not save page ${page.id} to database API:`, e);
      return false;
    }
  }
};
