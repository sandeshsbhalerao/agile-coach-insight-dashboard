export interface Team {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export interface AnalysisResult {
  fileId: string;
  timestamp: number;
  content: string;
  sentiment: number; // -1 to 1
  blockersCount: number;
}

export interface TeamTrend {
  date: string;
  sentiment: number;
  blockers: number;
}
