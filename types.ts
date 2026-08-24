export type AttachmentType = 'file' | 'url' | 'drive' | 'image';

export interface Attachment {
  id: string;
  name: string;
  type: AttachmentType;
  url: string;
  date: string;
  size?: string;
}

export interface Criterion {
  id: string;
  text: string;
  isMet: boolean;
}

export interface PortfolioSection {
  id: string;
  name: string;
}

export interface PortfolioPage {
  id: number;
  sectionId?: string; // Optional for backward compatibility, will default to "school-admin"
  code?: string; // رمز المعيار حسب الدليل الإجرائي
  title: string;
  iconName: string; // Lucide icon reference
  description: string;
  criteria: Criterion[];
  attachments: Attachment[];
}

export interface PortfolioConfig {
  managerName: string;
  schoolName: string;
  year: string;
  managerTitle: string;
  logoUrl?: string;
  managerPhotoUrl?: string;
  biography: string;
  vision?: string;
  mission?: string;
  values?: string;
}
