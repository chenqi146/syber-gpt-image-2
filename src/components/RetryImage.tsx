import { ImageOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { useSite } from '../site';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
};

const RETRY_DELAYS = [1000, 2500, 5000];

function retrySrc(src: string, attempt: number) {
  if (attempt <= 0 || src.startsWith('blob:') || src.startsWith('data:')) {
    return src;
  }
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}retry=${attempt}`;
}

export default function RetryImage({ src, alt = '', className = '', onError, onLoad, ...props }: Props) {
  const { t } = useSite();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    setAttempt(0);
    setFailed(!src);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`flex min-h-24 flex-col items-center justify-center gap-2 bg-black/70 p-3 text-center ${className}`}>
        <ImageOff size={18} className="text-white/25" />
        <div className="text-[10px] uppercase tracking-widest text-white/40">{t('image_load_failed')}</div>
        {src ? (
          <button
            className="flex h-8 items-center gap-2 border border-primary/25 px-3 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setFailed(false);
              setAttempt((current) => current + 1);
            }}
          >
            <RefreshCw size={12} />
            {t('image_retry')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <img
      {...props}
      alt={alt}
      className={className}
      src={retrySrc(src, attempt)}
      onLoad={(event) => {
        setFailed(false);
        onLoad?.(event);
      }}
      onError={(event) => {
        onError?.(event);
        if (attempt < RETRY_DELAYS.length) {
          window.setTimeout(() => setAttempt((current) => current + 1), RETRY_DELAYS[attempt]);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
