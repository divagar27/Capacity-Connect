export interface PassageCitation {
  documentId: string;
  documentTitle: string;
  sectionTitle: string;
  sourceType: 'CURRICULUM_LESSON' | 'OPERATIONAL_MANUAL' | 'BULLETIN';
  reference: string;
  pageNumber?: number;
  lessonId?: string;
  courseId?: string;
}

export interface SearchPassage {
  id: string;
  documentId: string;
  documentTitle: string;
  sectionTitle: string;
  courseId: string;
  lessonId?: string;
  sourceType: 'CURRICULUM_LESSON' | 'OPERATIONAL_MANUAL' | 'BULLETIN';
  content: string;
  keywords: string[];
  reference: string;
  pageNumber?: number;
}

export interface OfflineSearchResponse {
  query: string;
  expandedQueryTokens: string[];
  totalMatches: number;
  answerSummary: string;
  bestPassages: {
    passage: SearchPassage;
    score: number;
    matchDetails: string[];
  }[];
  unsupported: boolean;
  searchMethod: 'BM25_EXTRACTIVE_LOCAL';
}

export interface PracticeQuestion {
  id: string;
  prompt: string;
  topicTag: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  explanation: string;
  citation: PassageCitation;
  options: {
    id: string;
    text: string;
    isCorrect: boolean;
  }[];
}

export interface TopicRemediationItem {
  topicTag: string;
  missedCount: number;
  totalTested: number;
  recommendedLessonTitle: string;
  recommendedLessonId: string;
  courseId: string;
  remediationAdvice: string;
  referencePassage: string;
}

export interface OfflineStudyPack {
  packId: string;
  courseId: string;
  courseTitle: string;
  version: string;
  issuedAt: string;
  estimatedSizeKb: number;
  glossary: Record<string, string>;
  passages: SearchPassage[];
  practiceQuestions: PracticeQuestion[];
}
