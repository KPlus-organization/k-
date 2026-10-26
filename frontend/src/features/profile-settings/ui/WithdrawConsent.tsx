import { useState } from 'react';
import { errorMessage } from '@/shared/api';
import { cx } from '@/shared/lib';
import { ui } from '@/shared/ui';

/**
 * Withdraws the consent to personal data processing after a confirmation. The profile
 * cannot be entered until the consent is given again at sign-in, and is deleted after 30 days.
 */
export function WithdrawConsent({
  onOpenConsent,
  onWithdraw,
}: {
  onOpenConsent: () => void;
  onWithdraw: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const consentLink = (
    <button
      type="button"
      className="text-brand underline underline-offset-2"
      onClick={onOpenConsent}
    >
      согласие на обработку персональных данных
    </button>
  );
  return (
    <section
      className="mt-6 grid gap-3 border-t border-[#dfe3e9] pt-5 text-[13px] leading-[19px]"
      aria-label="Согласие на обработку персональных данных"
    >
      {confirming ? (
        <>
          <p role="alert">
            После отзыва вы выйдете из профиля и не сможете войти, пока снова не дадите{' '}
            {consentLink}. Если не войти с новым согласием в течение 30 дней, профиль и все
            сохранённые в нём данные будут удалены.
          </p>
          {error && (
            <p className={ui['form-error']} role="alert">
              {error}
            </p>
          )}
          <div className={ui['button-row']}>
            <button
              type="button"
              className={cx(ui['button'], ui['primary'])}
              aria-disabled={pending}
              onClick={async () => {
                if (pending) return;
                setError('');
                setPending(true);
                try {
                  await onWithdraw();
                } catch (caught) {
                  setError(errorMessage(caught));
                  setPending(false);
                }
              }}
            >
              {pending ? 'Отзываем согласие…' : 'Подтвердить отзыв'}
            </button>
            <button
              type="button"
              className={cx(ui['button'], ui['neutral'])}
              onClick={() => {
                setConfirming(false);
                setError('');
              }}
            >
              Отмена
            </button>
          </div>
        </>
      ) : (
        <p>
          <button
            type="button"
            className="text-[#a5322e] underline underline-offset-2"
            onClick={() => setConfirming(true)}
          >
            Отозвать
          </button>{' '}
          {consentLink}
        </p>
      )}
    </section>
  );
}
