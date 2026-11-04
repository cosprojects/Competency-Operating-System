/** Ошибка стадии: код, ретраибельность и человеческое сообщение. */
export class StageError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable = true) {
    super(message);
    this.name = "StageError";
    this.code = code;
    this.retryable = retryable;
  }
}
