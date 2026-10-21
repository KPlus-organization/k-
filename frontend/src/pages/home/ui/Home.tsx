import { Link } from 'react-router-dom';
import { cx, type Open } from '@/shared/lib';
import { visibleTools } from '@/shared/config';
import { Icon, ui } from '@/shared/ui';
import { LegalNotice } from '@/widgets/legal-notice';
import styles from './styles.module.css';

export function Home({ open, toolAction }: { open: Open; toolAction: Open }) {
  return (
    <div className={cx(ui['container'], styles['home'])}>
      <section className={styles['home-intro']}>
        <div>
          <div className={cx(ui['eyebrow'], styles['eyebrow'])}>
            ДЛЯ СОЗДАТЕЛЕЙ САЙТОВ И ПРИЛОЖЕНИЙ
          </div>
          <h1>Мой продукт. Мои права.</h1>
          <p>
            Разрабатываете сайт или приложение? Разберитесь в правах на все элементы продукта — от
            первой строки кода до названия. Простым языком.
          </p>
        </div>
        <img
          src="/images/digital-rights.svg"
          alt="Авторские права на цифровой продукт: знак © в скобках кода"
          width={362}
          height={200}
        />
      </section>
      <section className={styles['action-grid']} aria-label="С чего начать">
        <Link className={styles['action-card']} to="/ownership">
          <div className={styles['action-top']}>
            <span className={ui['icon-tile']}>
              <Icon name="file" />
            </span>
          </div>
          <h2>Оформить права</h2>
          <p>
            Кому принадлежат результаты разработки? Как оформить отношения с сотрудниками,
            подрядчиками и заказчиками?
          </p>
          <span className={styles['action-link']}>
            Разобраться в оформлении <Icon name="arrowRight" />
          </span>
        </Link>
        <Link className={styles['action-card']} to="/protect">
          <div className={styles['action-top']}>
            <span className={ui['icon-tile']}>
              <Icon name="shield" />
            </span>
          </div>
          <h2>Защитить нарушенные права</h2>
          <p>Ваш продукт или его часть используют без разрешения? Разберитесь, как действовать.</p>
          <span className={styles['action-link']}>
            Открыть общий чек-лист <Icon name="arrowRight" />
          </span>
        </Link>
        <Link className={styles['action-card']} to="/defend">
          <div className={styles['action-top']}>
            <span className={ui['icon-tile']}>
              <Icon name="messages" />
            </span>
          </div>
          <h2>Оспорить претензию о нарушении чужих прав</h2>
          <p>Вам предъявили претензию или иск о нарушении чужих прав? Подготовьте ответ.</p>
          <span className={styles['action-link']}>
            Открыть общий чек-лист <Icon name="arrowRight" />
          </span>
        </Link>
      </section>
      <section className={styles['tools-section']}>
        <div className={styles['section-heading']}>
          <h2>Ответы и инструменты под рукой</h2>
          <p>Для конкретного вопроса — воспользуйтесь поиском</p>
        </div>
        <div className={styles['tools-grid']}>
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              className={styles['tool-card']}
              onClick={() => toolAction(tool.id)}
            >
              <span className={styles['tool-title']}>
                <Icon name={tool.icon} />
                <strong>{tool.title}</strong>
                <Icon name="arrowUp" size={15} />
              </span>
              <p>{tool.description}</p>
            </button>
          ))}
        </div>
      </section>
      <LegalNotice open={open} />
    </div>
  );
}
