import { useState } from 'react';
import { cx } from '@/shared/lib';
import { Icon } from '../icon/Icon';
import ui from '../styles.module.css';
import styles from './styles.module.css';

export function PasswordField({
  label = 'Пароль',
  name = 'password',
  placeholder = 'Введите пароль',
  register = false,
  className,
}: {
  label?: string;
  name?: string;
  placeholder?: string;
  register?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className={ui['field']}>
      {label}
      <span className={cx(styles['password-input'], className)}>
        <input
          name={name}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          required
          minLength={register ? 8 : 1}
          maxLength={128}
          autoComplete={register ? 'new-password' : 'current-password'}
        />
        <button
          type="button"
          aria-label={`${visible ? 'Скрыть' : 'Показать'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </span>
    </label>
  );
}
