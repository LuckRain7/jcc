export interface Composition {
  id: string;
  name: string;
  note: string | null;
  code: string;
  created_at: string;
  updated_at: string;
  // 置顶时间戳；null/缺省表示未置顶。同步到云端，多设备共享。
  pinned_at?: string | null;
}
