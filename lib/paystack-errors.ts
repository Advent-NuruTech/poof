export class DonationError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = "DonationError";
  }
}
