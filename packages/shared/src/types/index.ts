export interface StandardResponse<T> {
  success: boolean;
  statusCode: number;
  data: T;
  message?: string;
  timestamp: string;
}

export interface StandardErrorResponse {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}export * from './offline-assistant';
