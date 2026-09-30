export class AiRequestGate {
  private generation = 0;
  private inFlight = false;

  begin(): number | null {
    if (this.inFlight) return null;
    this.inFlight = true;
    this.generation += 1;
    return this.generation;
  }

  invalidate(): void {
    this.generation += 1;
    this.inFlight = false;
  }

  isCurrent(requestId: number): boolean {
    return requestId === this.generation;
  }

  finish(requestId: number): boolean {
    if (!this.isCurrent(requestId)) return false;
    this.inFlight = false;
    return true;
  }
}
