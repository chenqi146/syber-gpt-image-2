export type ReferenceImageEntry = {
  id: string;
  file: File;
  role: string;
  note: string;
};

export const DEFAULT_REFERENCE_ROLE = '主体/主图';

export const REFERENCE_ROLE_OPTIONS = [
  { value: '主体/主图', labelKey: 'reference_role_subject' },
  { value: '正面', labelKey: 'reference_role_front' },
  { value: '侧面', labelKey: 'reference_role_side' },
  { value: '背面', labelKey: 'reference_role_back' },
  { value: '材质细节', labelKey: 'reference_role_material' },
  { value: '颜色参考', labelKey: 'reference_role_color' },
  { value: '结构款式', labelKey: 'reference_role_structure' },
  { value: '场景参考', labelKey: 'reference_role_scene' },
  { value: '风格参考', labelKey: 'reference_role_style' },
  { value: '排版参考', labelKey: 'reference_role_layout' },
  { value: '其他', labelKey: 'reference_role_other' },
] as const;

export function createReferenceEntry(file: File, role = DEFAULT_REFERENCE_ROLE): ReferenceImageEntry {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    role,
    note: '',
  };
}

