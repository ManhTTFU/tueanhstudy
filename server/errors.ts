export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Cần xác nhận phụ huynh') => new ApiError(401, 'unauthorized', message);
export const notFound = (message = 'Không tìm thấy') => new ApiError(404, 'not_found', message);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);
export const unprocessable = (message: string, details?: unknown) => new ApiError(422, 'invalid_data', message, details);
export const tooManyRequests = (message = 'Bé thao tác nhanh quá, đợi một chút nhé!') =>
  new ApiError(429, 'rate_limited', message);
