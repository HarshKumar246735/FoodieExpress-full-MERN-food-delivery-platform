import { useState } from 'react';
import { imageUrl } from '../services/api';

/**
 * Consistent-ratio photo with lazy loading, meaningful alt text and a graceful fallback
 * (a labelled tile) if the photo is missing or fails to load.
 * ratio: CSS aspect-ratio string, e.g. '4 / 3'.
 */
export default function FoodImage({ src, alt, ratio = '4 / 3', className = '', eager = false, label }) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(src);
  const style = { aspectRatio: ratio };
  if (!url || failed) {
    return (
      <div className={`fimg fimg--fallback ${className}`} style={style} role="img" aria-label={alt || 'Image unavailable'}>
        <span>{label || alt || 'FoodieExpress'}</span>
      </div>
    );
  }
  return (
    <div className={`fimg ${className}`} style={style}>
      <img src={url} alt={alt || ''} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </div>
  );
}
