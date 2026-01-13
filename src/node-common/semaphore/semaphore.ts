export class Semaphore {
  private tasks: (() => void)[] = [];
  private count: number;

  /** Create a new sempahore instance.
   * @param maxConcurrency max concurrent tasks. Default is 1
   */
  constructor(maxConcurrency: number = 1) {
    this.count = maxConcurrency;
  }

  acquire(): Promise<void> {
    return new Promise<void>(resolve => {
      const task = () => {
        this.count--;
        resolve();
      };

      if (this.count > 0) {
        task();
      } else {
        this.tasks.push(task);
      }
    });
  }

  release(): void {
    if (this.tasks.length > 0) {
      const next = this.tasks.shift();
      if (next) next();
    } else {
      this.count++;
    }
  }

  isBusy = () => this.count > 0
}