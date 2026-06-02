const DEFAULT_PAGE_SIZE = 1000;

export const fetchAllSupabaseRows = async <T>(
  createQuery: () => any,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<T[]> => {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await createQuery().range(from, to);

    if (error) {
      throw error;
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return rows;
};

export const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};
