import { useState, type FormEvent } from 'react';
import { profileFieldHints, type Profile } from '@/entities/profile';
import { cx, validateForm } from '@/shared/lib';
import { Icon, ui } from '@/shared/ui';
import styles from './styles.module.css';

export function LawyerRequest({
  profile,
  onSubmitted,
}: {
  profile: Profile | null;
  onSubmitted: () => void;
}) {
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const invalid = validateForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    const data = new FormData(form);
    if (String(data.get('task')).trim().length < 10) {
      setError('Опишите задачу подробнее: не менее 10 символов без пробелов по краям.');
      const field = form.elements.namedItem('task');
      if (field instanceof HTMLTextAreaElement) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
      }
      return;
    }
    // Frontend prototype: connect the request API here when the backend is ready.
    onSubmitted();
  };

  return (
    <form className={styles['form']} onSubmit={submit} noValidate>
      <p className={styles['intro']}>
        Расскажите, с каким вопросом нужна помощь: что произошло и какого результата вы хотите
        добиться.
      </p>
      <div className={styles['identity']}>
        <label className={ui['field']}>
          Имя
          <input
            name="name"
            defaultValue={profile?.name ?? ''}
            autoComplete="name"
            placeholder="Как к вам обращаться"
            required
            maxLength={100}
            pattern=".*\S.*"
          />
        </label>
        <label className={ui['field']}>
          Электронная почта
          <input
            name="email"
            type="email"
            defaultValue={profile?.email ?? ''}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Куда ответить"
            required
            maxLength={254}
            title={profileFieldHints['email']}
          />
        </label>
      </div>
      <label className={ui['field']}>
        Коротко о задаче
        <textarea
          name="task"
          className={styles['textarea']}
          placeholder="Например: наш код используют без разрешения. Хотим понять, какие доказательства собрать и как направить претензию."
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          aria-describedby="lawyer-task-hint"
        />
      </label>
      <p id="lawyer-task-hint" className={styles['hint']}>
        От 10 до 2 000 символов.
      </p>
      {error && (
        <p role="alert" className={ui['form-error']}>
          {error}
        </p>
      )}
      <button type="submit" className={cx(ui['button'], ui['primary'], styles['submit'])}>
        Отправить заявку <Icon name="arrowRight" size={18} />
      </button>
    </form>
  );
}
