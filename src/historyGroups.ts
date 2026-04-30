import type { HistoryItem } from './api';

export type HistoryGroupImage = {
  id: string;
  url: string;
  prompt: string;
  item: HistoryItem;
};

export type HistoryGroup = {
  key: string;
  first: HistoryItem;
  items: HistoryItem[];
  images: HistoryGroupImage[];
  createdAt: string;
  publishedCount: number;
  allPublished: boolean;
  taskPrompt: string;
  title: string;
  ecommerceName: string;
  isEcommerce: boolean;
};

export function mergeHistoryItems(items: HistoryItem[]) {
  const merged = new Map<string, HistoryItem>();
  for (const item of items) {
    merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function groupHistoryItems(items: HistoryItem[]) {
  const groups = new Map<string, HistoryItem[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = item.task_id || item.id;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  return order
    .map((key): HistoryGroup | null => {
      const groupItems = groups.get(key) || [];
      const sorted = [...groupItems].sort((a, b) => {
        const batchDelta = (a.batch_index || 0) - (b.batch_index || 0);
        if (batchDelta !== 0) return batchDelta;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      const first = sorted[0];
      if (!first) {
        return null;
      }
      const images = sorted
        .filter((item) => item.image_url)
        .map((item) => ({ id: item.id, url: item.image_url || '', prompt: item.prompt, item }));
      const publishableItems = sorted.filter((item) => item.status === 'succeeded' && Boolean(item.image_url));
      const publishedCount = publishableItems.filter((item) => item.published).length;
      const createdAt = sorted.reduce(
        (latest, item) => (new Date(item.created_at).getTime() > new Date(latest).getTime() ? item.created_at : latest),
        first.created_at,
      );
      const ecommerceName = first.task_request?.ecommerce?.product_name?.trim() || '';
      const taskPrompt = first.task_prompt || first.prompt;
      return {
        key,
        first,
        items: sorted,
        images,
        createdAt,
        publishedCount,
        allPublished: publishableItems.length > 0 && publishedCount === publishableItems.length,
        taskPrompt,
        title: ecommerceName || (images.length > 1 ? `${first.mode.toUpperCase()} BATCH` : first.mode.toUpperCase()),
        ecommerceName,
        isEcommerce: Boolean(first.task_request?.ecommerce),
      };
    })
    .filter((group): group is HistoryGroup => Boolean(group))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
