export abstract class DomainId<T> {
  /** The id of the domain */
  protected readonly id: T;

  /** Initializes a new instance of the DomainId class.
   * @param id The id of the domain
   */
  protected constructor(id: T) {
    this.id = id;
  }

  /** Returns the value of the domain id */
  get value(): string {
    return this.toString();
  }

  /** The string representation of the domain id */
  toString(): string {
    return String(this.id);
  }

  /** Checks if the domain id is equal to another domain id */
  equals(other: DomainId<T>): boolean {
    return this.id === other.id;
  }
}