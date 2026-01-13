/** Create a promise and return it after the given delay in MS
 * @param ms - Delay in milliseconds
 */
export async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Verify if the lists have the same items, return `true` if items are the same, `false` otherwise */
export function compareLists<T>(firstList: T[], secondList: T[]): boolean {
  if (firstList.length !== secondList.length) {
    return false;
  }

  const sortedFirstList = [...firstList].sort();
  const sortedSecondList = [...secondList].sort();

  for (let i = 0; i < sortedFirstList.length; i++) {
    if (sortedFirstList[i] !== sortedSecondList[i]) {
      return false;
    }
  }

  return true;
}

/** Used to chunk an array into smaller arrays */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
