export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string): AppError {
    return new AppError(message, 400);
  }

  public static unauthorized(message: string = "Unauthorized access."): AppError {
    return new AppError(message, 401);
  }

  public static forbidden(message: string = "Forbidden access."): AppError {
    return new AppError(message, 403);
  }

  public static notFound(message: string = "Resource not found."): AppError {
    return new AppError(message, 404);
  }

  public static conflict(message: string): AppError {
    return new AppError(message, 409);
  }

  public static internal(message: string = "Internal server error."): AppError {
    return new AppError(message, 500);
  }
}
