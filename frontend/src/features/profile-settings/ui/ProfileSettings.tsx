import { cx } from '@/shared/lib';
import { ui } from '@/shared/ui';
import { type Profile } from '@/entities/profile';

export function ProfileSettings({
  profile,
  onSave,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
}) {
  return (
    <form
      className="grid gap-4.5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSave({
          ...profile,
          name: String(data.get('name')).trim(),
          login: String(data.get('login')).trim(),
          email: String(data.get('email')).trim(),
        });
      }}
    >
      <label className={ui['field']}>
        Имя
        <input name="name" defaultValue={profile.name} required pattern=".*\S.*" />
      </label>
      <label className={ui['field']}>
        Логин
        <input name="login" defaultValue={profile.login} minLength={3} required pattern=".*\S.*" />
      </label>
      <label className={ui['field']}>
        Электронная почта
        <input name="email" type="email" defaultValue={profile.email} required />
      </label>
      <button className={cx(ui['button'], ui['primary'], 'mt-2')} type="submit">
        Сохранить изменения
      </button>
    </form>
  );
}
