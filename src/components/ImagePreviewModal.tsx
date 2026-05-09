import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSite } from '../site';
import RetryImage from './RetryImage';

export type PreviewImage = {
  id?: string;
  url: string;
  prompt?: string | null;
  title?: string | null;
  subtitle?: string | null;
};

type Props = {
  imageUrl?: string | null;
  images?: PreviewImage[];
  initialIndex?: number;
  alt?: string;
  subtitle?: string | null;
  onClose: () => void;
};

export default function ImagePreviewModal({ imageUrl, images, initialIndex = 0, alt = 'preview', subtitle, onClose }: Props) {
  const { t } = useSite();
  const gallery = useMemo(() => {
    const validImages = (images || []).filter((image) => image.url);
    if (validImages.length > 0) {
      return validImages;
    }
    return imageUrl ? [{ url: imageUrl, prompt: subtitle || alt }] : [];
  }, [alt, imageUrl, images, subtitle]);
  const galleryKey = gallery.map((image) => image.url).join('|');
  const [index, setIndex] = useState(initialIndex);
  const currentIndex = gallery.length > 0 ? Math.max(0, Math.min(index, gallery.length - 1)) : 0;
  const current = gallery[currentIndex];
  const currentSubtitle = current?.subtitle || current?.prompt || subtitle || '';
  const hasMultiple = gallery.length > 1;

  useEffect(() => {
    setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, gallery.length - 1))));
  }, [gallery.length, galleryKey, initialIndex]);

  useEffect(() => {
    if (!current) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft' && hasMultiple) {
        setIndex((value) => (value <= 0 ? gallery.length - 1 : value - 1));
      }
      if (event.key === 'ArrowRight' && hasMultiple) {
        setIndex((value) => (value >= gallery.length - 1 ? 0 : value + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current, gallery.length, hasMultiple, onClose]);

  if (!current) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-6xl border border-primary/30 bg-surface-container-high shadow-[0_0_40px_rgba(0,243,255,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-secondary">{t('modal_preview')}</div>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              {hasMultiple ? <span className="shrink-0 text-xs font-bold text-primary">{currentIndex + 1} / {gallery.length}</span> : null}
              {currentSubtitle ? <div className="min-w-0 truncate text-sm text-white/70">{currentSubtitle}</div> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="flex h-10 items-center gap-2 border border-white/10 px-4 text-xs font-bold uppercase tracking-widest text-white/70 transition-colors hover:border-primary hover:text-primary"
              href={current.url}
              download
              title={t('modal_download')}
            >
              <Download size={14} />
              {t('modal_download')}
            </a>
            <a
              className="flex h-10 items-center gap-2 border border-primary/30 px-4 text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
              href={current.url}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={14} />
              {t('modal_open_image')}
            </a>
            <button
              className="flex h-10 w-10 items-center justify-center border border-white/10 text-white/60 transition-colors hover:border-primary hover:text-primary"
              type="button"
              onClick={onClose}
              title={t('modal_close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="relative flex max-h-[80vh] items-center justify-center overflow-auto bg-black p-4">
          {hasMultiple ? (
            <>
              <button
                className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/70 text-white/75 backdrop-blur transition-colors hover:border-primary hover:text-primary"
                type="button"
                onClick={() => setIndex((value) => (value <= 0 ? gallery.length - 1 : value - 1))}
                title={t('modal_previous')}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/70 text-white/75 backdrop-blur transition-colors hover:border-primary hover:text-primary"
                type="button"
                onClick={() => setIndex((value) => (value >= gallery.length - 1 ? 0 : value + 1))}
                title={t('modal_next')}
              >
                <ChevronRight size={22} />
              </button>
            </>
          ) : null}
          <RetryImage alt={current.title || alt} className="max-h-[75vh] w-auto max-w-full object-contain" src={current.url} />
        </div>
      </div>
    </div>
  );
}
