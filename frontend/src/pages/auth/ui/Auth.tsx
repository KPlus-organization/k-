import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/shared/api';
import { cx, validateForm, type Open } from '@/shared/lib';
import { Icon, type IconName, PasswordField, ui } from '@/shared/ui';
import { profileFieldHints } from '@/entities/profile';
import { type RegisterData } from '@/features/session';
import styles from './styles.module.css';

/** Where to go after signing in: ?next= if it is a path on this site, else the profile. */
function nextPath(next: string | null) {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/profile';
}

export function Auth({
  register,
  login,
  signUp,
  open,
}: {
  register: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signUp: (data: RegisterData) => Promise<void>;
  open: Open;
}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next');
  const keepNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = validateForm(event.currentTarget);
    if (invalid) {
      setError(invalid);
      return;
    }
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password'));
    if (register && password !== data.get('confirm')) {
      setError('Пароли не совпадают. Проверьте повторный ввод.');
      return;
    }
    setError('');
    setPending(true);
    try {
      if (register)
        await signUp({
          login: String(data.get('login')).trim(),
          email: String(data.get('email')).trim(),
          password,
          consent: true,
        });
      else await login(String(data.get('email')).trim(), password);
      navigate(nextPath(next));
    } catch (caught) {
      setError(errorMessage(caught, profileFieldHints));
      setPending(false);
    }
  };
  return (
    <div className={styles['auth-page']}>
      <Link className={ui['back-link']} to="/">
        <Icon name="arrowLeft" size={18} />
        На главную
      </Link>
      <div className={styles['auth-grid']}>
        <section className={styles['auth-benefits']}>
          <div className={cx(ui['eyebrow'], styles['eyebrow'])}>ВАШ ЛИЧНЫЙ КАБИНЕТ</div>
          <h1>
            Мой продукт.
            <br />
            Мои права.
          </h1>
          <p>Наиболее важное для Вас об интеллектуальной собственности — в одном профиле.</p>
          <img src="/images/profile-protection.png" alt="Код под защитой щита" />
          <div className={styles['benefits']}>
            {(
              [
                {
                  icon: 'bookmark',
                  title: 'Сохраняйте полезные материалы',
                  text: 'Статьи и ответы — всегда под рукой.',
                },
                {
                  icon: 'history',
                  title: 'Возвращайтесь к своим вопросам',
                  text: 'История работы с сервисом в одном месте.',
                },
                {
                  icon: 'files',
                  title: 'Работайте с документами',
                  text: 'Инструменты для оформления ваших прав.',
                },
              ] as { icon: IconName; title: string; text: string }[]
            ).map((item) => (
              <div key={item.title}>
                <span className={cx(ui['icon-tile'], styles['icon-tile'])}>
                  <Icon name={item.icon} size={19} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className={undefined}>
          <nav className={styles['auth-tabs']} aria-label="Вход и регистрация">
            <Link
              className={!register ? cx(ui['selected'], styles['selected']) : undefined}
              to={keepNext('/login')}
              aria-current={!register ? 'page' : undefined}
            >
              Войти в профиль
            </Link>
            <Link
              className={register ? cx(ui['selected'], styles['selected']) : undefined}
              to={keepNext('/register')}
              aria-current={register ? 'page' : undefined}
            >
              Создать профиль
            </Link>
          </nav>
          <form
            className={cx(
              styles['auth-form'],
              register ? styles['register-form'] : styles['login-form'],
            )}
            onSubmit={submit}
            noValidate
          >
            <h2>{register ? 'Создать профиль' : 'Войти в профиль'}</h2>
            <p>
              {register
                ? 'Сохраните всё важное в личном кабинете.'
                : 'Рады видеть вас снова. Продолжите работу с материалами и инструментами сервиса.'}
            </p>
            <div className={styles['form-fields']}>
              {register && (
                <label className={ui['field']}>
                  Логин
                  <input
                    required
                    name="login"
                    placeholder="Придумайте логин"
                    autoComplete="username"
                    minLength={3}
                    maxLength={32}
                    pattern="[\p{L}\p{N}._\-]+"
                    title={profileFieldHints['login']}
                  />
                </label>
              )}
              <label className={ui['field']}>
                {register ? 'Электронная почта' : 'Электронная почта или логин'}
                <input
                  name="email"
                  type={register ? 'email' : 'text'}
                  required
                  placeholder={register ? 'Введите email' : 'Введите email или логин'}
                  autoComplete={register ? 'email' : 'username'}
                />
              </label>
              <PasswordField
                className={styles['password-input']}
                register={register}
                placeholder={register ? 'Не менее 8 символов' : 'Введите пароль'}
              />
              {register && (
                <PasswordField
                  className={styles['password-input']}
                  register
                  label="Подтверждение пароля"
                  name="confirm"
                  placeholder="Повторите пароль"
                />
              )}
            </div>
            {register ? (
              <label className={styles['consent']}>
                <input
                  type="checkbox"
                  required
                  name="consent"
                  data-required-message="Подтвердите согласие на обработку персональных данных."
                />
                <span>
                  Я даю{' '}
                  <button type="button" onClick={() => open('privacy')}>
                    согласие на обработку персональных данных
                  </button>{' '}
                  и ознакомлен(а) с{' '}
                  <button type="button" onClick={() => open('privacy')}>
                    политикой конфиденциальности.
                  </button>
                </span>
              </label>
            ) : (
              <button className={styles['forgot']} type="button" onClick={() => open('reset')}>
                Забыли пароль?
              </button>
            )}
            {error && (
              <p className={ui['form-error']} role="alert">
                {error}
              </p>
            )}
            <button
              className={cx(ui['button'], ui['primary'], styles['submit'])}
              type="submit"
              disabled={pending}
            >
              {register ? 'Создать профиль' : 'Войти в профиль'}
            </button>
            <div className={styles['auth-switch']}>
              {register ? 'Уже есть профиль?' : 'Ещё нет профиля?'}{' '}
              <Link to={keepNext(register ? '/login' : '/register')}>
                {register ? 'Войти' : 'Создать профиль'}
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
