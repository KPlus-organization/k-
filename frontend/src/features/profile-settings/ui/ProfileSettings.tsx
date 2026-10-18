import { useState } from 'react';
import { errorMessage } from '@/shared/api';
import { cx, validateForm } from '@/shared/lib';
import { ui } from '@/shared/ui';
import { profileFieldHints, type Profile } from '@/entities/profile';

type Changes = Partial<Pick<Profile, 'name' | 'login' | 'email'>>;

export function ProfileSettings({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (changes: Changes) => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="grid gap-4.5"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        const invalid = validateForm(event.currentTarget);
        if (invalid) {
          setError(invalid);
          return;
        }
        const data = new FormData(event.currentTarget);
        const changes: Changes = {};
        for (const field of ['name', 'login', 'email'] as const) {
          const value = String(data.get(field)).trim();
          if (value !== profile[field]) changes[field] = value;
        }
        setError('');
        setSaving(true);
        try {
          await onSave(changes);
        } catch (caught) {
          setError(errorMessage(caught, profileFieldHints));
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className={ui['field']}>
        Имя
        <input name="name" defaultValue={profile.name} required maxLength={100} pattern=".*\S.*" />
      </label>
      <label className={ui['field']}>
        Логин
        <input
          name="login"
          defaultValue={profile.login}
          minLength={3}
          maxLength={32}
          required
          pattern="[\p{L}\p{N}._\-]+"
          title={profileFieldHints['login']}
        />
      </label>
      <label className={ui['field']}>
        Электронная почта
        <input name="email" type="email" defaultValue={profile.email} required />
      </label>
      {error && (
        <p className={ui['form-error']} role="alert">
          {error}
        </p>
      )}
      <button
        className={cx(ui['button'], ui['primary'], 'mt-2')}
        type="submit"
        aria-disabled={saving}
      >
        {saving ? 'Сохранение…' : 'Сохранить изменения'}
      </button>
    </form>
  );
}
