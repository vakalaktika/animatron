/** A share id as the studio makes them: ten URL-safe characters. */
const SHAPE = /^[A-Za-z0-9_-]{10}$/;

export const isShareId = (value: string): boolean => SHAPE.test(value);
