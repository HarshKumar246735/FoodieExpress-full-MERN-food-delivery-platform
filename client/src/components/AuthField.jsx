import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Labelled input with inline error + hint. type="password" gets a show/hide toggle. */
export default function AuthField({ label, error, hint, type = 'text', as = 'input', className = '', children, ...rest }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  const common = { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-e` : hint ? `${id}-h` : undefined };
  let control;
  if (as === 'select') control = <select className={`select ${error ? 'input--error' : ''}`} {...common} {...rest}>{children}</select>;
  else if (as === 'textarea') control = <textarea className={`textarea ${error ? 'input--error' : ''}`} {...common} {...rest} />;
  else control = <input className={`input ${error ? 'input--error' : ''}`} type={isPw && show ? 'text' : type} {...common} {...rest} />;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {isPw ? (
        <div className="auth-pw">
          {control}
          <button type="button" className="auth-pw__toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      ) : control}
      {error ? <span id={`${id}-e`} className="field__error" role="alert">{error}</span> : hint ? <span id={`${id}-h`} className="field__hint">{hint}</span> : null}
    </div>
  );
}
