export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ExtractedDoc {
  title: string;
  url: string;
  content: string;
  charCount: number;
}

export interface AnswerRequest {
  query: string;
  maxLinks?: number;
  siteFilter?: string[];
}

export interface AnswerResponse {
  answer: string;
  sources: Array<{ title: string; url: string }>;
  meta: {
    tookMs: number;
    partial?: boolean;
  };
}

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: {
    googleCse: boolean;
    lmStudio: boolean;
  };
}
