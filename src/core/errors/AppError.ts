// src/core/errors/AppError.ts
export class AppError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PermissionDeniedError extends AppError {
  constructor(message: string = '이 작업을 수행할 권한이 없습니다.') {
    super(message, 'PERMISSION_DENIED', 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = '잘못된 요청 데이터입니다.') {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = '데이터베이스 처리 중 오류가 발생했습니다.') {
    super(message, 'DATABASE_ERROR', 500);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '로그인이 필요합니다.') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
