import type { PaginatedResponse } from "@aegisai/shared";

interface SkippableQuery<T> extends PromiseLike<T[]> {
  skip(value: number): SkippableQuery<T>;
  limit(value: number): SkippableQuery<T>;
}

export async function paginate<T>(
  query: SkippableQuery<T>,
  countQuery: Promise<number>,
  page: number,
  limit: number
): Promise<PaginatedResponse<T>> {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([query.skip(skip).limit(limit), countQuery]);
  return { data, total, page, limit };
}