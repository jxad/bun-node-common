import * as uuid from "uuid";

/** UUID utility class */
export class UUID {
  static NIL = uuid.NIL;
  static MAX = uuid.MAX;

  /** Convert UUID string to array of bytes
   * @param uuidStr UUID string
   * @returns Array of bytes
   */
  static parseToBytes(uuidStr: string): Uint8Array {
    return uuid.parse(uuidStr);
  }

  /** Convert array of bytes to UUID string
   * @param bytes Array of bytes
   * @returns UUID string
   */
  static stringifyFromBytes(bytes: Uint8Array): string {
    return uuid.stringify(bytes);
  }

  /** Create a version 1 (timestamp) UUID
   * @returns UUID string
   */
  static getV1(): string {
    return uuid.v1();
  }

  /** Create a version 6 UUID from a version 1 UUID
   * @param uuidV1 UUID v1 string
   * @returns UUID v6 string
   */
  static convertV1ToV6(uuidV1: string): string {
    return uuid.v1ToV6(uuidV1);
  }

  /** Create a version 3 (namespace w/ MD5) UUID
   * @param name Name string
   * @param namespace Namespace UUID string
   * @returns UUID v3 string
   */
  static getV3(name: string, namespace: string): string {
    return uuid.v3(name, namespace);
  }

  /** Create a version 4 (random) UUID
   * @returns UUID v4 string
   */
  static getV4(): string {
    return uuid.v4();
  }

  /** Create a version 5 (namespace w/ SHA-1) UUID
   * @param name Name string
   * @param namespace Namespace UUID string
   * @returns UUID v5 string
   */
  static getV5(name: string, namespace: string): string {
    return uuid.v5(name, namespace);
  }

  /** Create a version 6 (timestamp, reordered) UUID
   * @returns UUID v6 string
   */
  static getV6(): string {
    return uuid.v6();
  } 

  /** Create a version 1 UUID from a version 6 UUID
   * @param uuidV6 UUID v6 string
   * @returns UUID v1 string
   */
  static convertV6ToV1(uuidV6: string): string {
    return uuid.v6ToV1(uuidV6);
  }

  /** Create a version 7 (Unix Epoch time-based) UUID
   * @returns UUID v7 string
   */
  static getV7(): string {
    return uuid.v7();
  }

  /** Test a string to see if it is a valid UUID
   * @param uuidStr UUID string
   * @returns True if valid, false otherwise
   */
  static validate(uuidStr: string): boolean {
    return uuid.validate(uuidStr);
  }

  /** Detect RFC version of a UUID
   * @param uuidStr UUID string
   * @returns Version number (1-8) or undefined if not valid UUID
   */
  static version(uuidStr: string): number | undefined {
    return uuid.version(uuidStr);
  }
}