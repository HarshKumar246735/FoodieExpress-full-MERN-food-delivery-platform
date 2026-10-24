import { useState } from 'react';
import { Check, Copy, Percent, Tag, Truck } from 'lucide-react';
import { rupee } from '../utils/format';
import { useToast } from '../context/ToastContext';
import '../css/section.css';

/** Copies text to the clipboard; falls back to a hidden textarea where the Clipboard API is unavailable. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

const describe = (c) => {
  if (c.type === 'FLAT') return `${rupee(c.value)} off`;
  if (c.type === 'PERCENT') return `${c.value}% off${c.maxDiscount ? ` up to ${rupee(c.maxDiscount)}` : ''}`;
  return 'Free delivery';
};
const ICON = { FLAT: Tag, PERCENT: Percent, FREESHIP: Truck };

/** One coupon "voucher": the code is real and the button really copies it. */
export default function PromoBanner({ coupon }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const Icon = ICON[coupon.type] || Tag;
  const onCopy = async () => {
    const ok = await copyText(coupon.code);
    if (ok) {
      setCopied(true);
      toast.success(`${coupon.code} copied. Paste it at the cart.`);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy. Select the code and copy it manually.');
    }
  };
  return (
    <article className="promo">
      <div className="promo__icon" aria-hidden="true"><Icon size={22} /></div>
      <div className="promo__body">
        <strong className="promo__deal">{describe(coupon)}</strong>
        <span className="promo__desc muted">{coupon.description || (coupon.minOrder ? `On orders above ${rupee(coupon.minOrder)}` : 'On any order')}</span>
      </div>
      <button type="button" className="promo__code" onClick={onCopy} aria-label={`Copy coupon code ${coupon.code}`}>
        <span>{coupon.code}</span>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
    </article>
  );
}
