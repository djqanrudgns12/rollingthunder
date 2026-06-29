import { EditorItem } from '@/store/editorStore';

export function classifyItems(items: EditorItem[]): {
  skeleton: EditorItem[];
  fillers: EditorItem[];
} {
  const skeleton: EditorItem[] = [];
  const fillers: EditorItem[] = [];

  for (const item of items) {
    if (item.type === 'wall' || item.type === 'piston' || item.type === 'spinner') {
      skeleton.push(item);
    } else if (
      item.id && (
        item.id.startsWith('ar_') ||
        item.id.startsWith('rm_') ||
        item.id.startsWith('cv_') ||
        item.id.startsWith('fn_') ||
        item.id.startsWith('sp_') ||
        item.id.startsWith('ln_') ||
        item.id.includes('_new')
      )
    ) {
      skeleton.push(item);
    } else {
      fillers.push(item);
    }
  }

  return { skeleton, fillers };
}
