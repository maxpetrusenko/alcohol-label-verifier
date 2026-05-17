export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => {
      return new Promise<void>((resolve, reject) => {
        const runNext = () => {
          if (cursor >= items.length) {
            resolve();
            return;
          }
          const index = cursor;
          cursor += 1;
          mapper(items[index], index).then((value) => {
            results[index] = value;
            runNext();
          }, reject);
        };
        runNext();
      });
    }),
  );

  return results;
}
