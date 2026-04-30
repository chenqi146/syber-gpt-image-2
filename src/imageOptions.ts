export const SIZE_OPTIONS = ['1K', '2K', '4K'];
export const IMAGE_COUNT_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const SIZE_LABELS: Record<string, string> = {
  '1K': '1K (1080p)',
  '2K': '2K (1440p)',
  '4K': '4K (2160p)',
};
export const ASPECT_RATIO_OPTIONS = ['1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4'];
export const QUALITY_OPTIONS = ['auto', 'low', 'medium', 'high'];
export const SIZE_PRESETS: Record<string, Record<string, string>> = {
  '1K': {
    '1:1': '1088x1088',
    '16:9': '2048x1152',
    '9:16': '1152x2048',
    '3:2': '1632x1088',
    '2:3': '1088x1632',
    '4:3': '1472x1104',
    '3:4': '1104x1472',
  },
  '2K': {
    '1:1': '1440x1440',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '3:2': '2160x1440',
    '2:3': '1440x2160',
    '4:3': '1920x1440',
    '3:4': '1440x1920',
  },
  '4K': {
    '16:9': '3840x2160',
    '9:16': '2160x3840',
    '3:2': '3840x2560',
    '2:3': '2560x3840',
    '4:3': '3840x2880',
    '3:4': '2880x3840',
  },
};

const SIZE_BY_PRESET_VALUE = Object.fromEntries(
  Object.entries(SIZE_PRESETS).flatMap(([scale, ratios]) =>
    Object.values(ratios).map((size) => [size.toUpperCase(), scale]),
  ),
);

export function normalizeImageScale(value: string | undefined) {
  const normalized = (value || '').trim().toUpperCase();
  if (SIZE_OPTIONS.includes(normalized)) {
    return normalized;
  }
  if (SIZE_BY_PRESET_VALUE[normalized]) {
    return SIZE_BY_PRESET_VALUE[normalized];
  }
  if (/^1\d{3}x1\d{3}$/i.test(normalized)) {
    return '1K';
  }
  if (/^2\d{3}x|x2\d{3}$/i.test(normalized)) {
    return '2K';
  }
  if (/^[34]\d{3}x|x[34]\d{3}$/i.test(normalized)) {
    return '4K';
  }
  return '2K';
}

export function providerImageSize(scale: string, ratio: string) {
  return SIZE_PRESETS[scale]?.[ratio] || SIZE_PRESETS['2K']['1:1'];
}

export function isSupportedImagePreset(scale: string, ratio: string) {
  return Boolean(SIZE_PRESETS[scale]?.[ratio]);
}
