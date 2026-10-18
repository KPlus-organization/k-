import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/shared/api';
import { cx, useDocumentTitle, validateForm } from '@/shared/lib';
import { LoadState, ui } from '@/shared/ui';
import {
  calculateFee,
  CLASS_COUNT_PARAMETER,
  formatDate,
  formatRubles,
  useFeeSchedule,
  useFeeSchedules,
  type Fee,
  type FeeParameter,
  type FeeResult,
  type FeeSchedule,
  type FeeValues,
} from '@/entities/fee';
import { useRecordVisit } from '@/features/history';
import { Breadcrumbs } from '@/widgets/page-heading';
import styles from './styles.module.css';

const FIPS_CALCULATOR = 'https://www1.fips.ru/podacha-zayavki/kalkulyator-poshlin/index.php';
const CALCULATOR_VISIT = {
  type: 'tool',
  target: 'calculator',
  title: 'Калькулятор пошлин',
} as const;
// Small ranges (classes 1–45, months 1–6) are chosen from a list, like on the FIPS site.
const MAX_SELECT_OPTIONS = 50;
// Plain-language hints for the first step, so the user knows which option is theirs.
const SCHEDULE_HINTS: Partial<Record<string, string>> = {
  trademarks: 'Название, логотип, знак обслуживания',
  programs: 'Код приложения или сайта, база данных',
};

/** 1 вид, 4 вида, 42 вида, 11 видов. */
function feeKinds(count: number) {
  const tens = count % 100;
  const ones = count % 10;
  const word =
    tens >= 11 && tens <= 14
      ? 'видов'
      : ones === 1
        ? 'вид'
        : ones >= 2 && ones <= 4
          ? 'вида'
          : 'видов';
  return `${count} ${word} пошлин`;
}

/** Group names in the order of the schedule. */
function groupsOf(schedule: FeeSchedule) {
  return [...new Set(schedule.fees.map((fee) => fee.group))];
}

/** «13 000 ₽ + 2 500 ₽ за каждый класс МКТУ сверх первого + …» */
function formula(fee: Fee) {
  const parts = fee.base > 0 || fee.surcharges.length === 0 ? [formatRubles(fee.base)] : [];
  for (const surcharge of fee.surcharges)
    parts.push(`${formatRubles(surcharge.amount)} за ${surcharge.label}`);
  return parts.join(' + ');
}

/** Moves focus to an element when it first appears, so keyboard users follow the steps. */
function useFocusOnMount<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);
  return ref;
}

/** One step of the wizard: a list to choose from, or the chosen item with «Изменить выбор». */
function Step({
  number,
  title,
  chosen,
  onReset,
  focus,
  children,
}: {
  number: number;
  title: string;
  chosen?: ReactNode;
  onReset?: () => void;
  /** Focus the heading when the step appears (not for the first step on page load). */
  focus: boolean;
  children?: ReactNode;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>(focus);
  return (
    <section className={styles['step']} aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} ref={heading} tabIndex={-1}>
        <span className={styles['step-number']}>Шаг {number}.</span> {title}
      </h2>
      {chosen ? (
        <div className={styles['chosen']}>
          <div className={styles['chosen-text']}>{chosen}</div>
          {onReset && (
            <button type="button" className={styles['reset']} onClick={onReset}>
              Изменить выбор
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function OptionList({
  options,
}: {
  options: { key: string; label: ReactNode; hint?: string; onSelect: () => void }[];
}) {
  return (
    <ol className={styles['options']}>
      {options.map((option, index) => (
        <li key={option.key}>
          <button type="button" className={styles['option']} onClick={option.onSelect}>
            <span className={styles['option-number']}>{index + 1}.</span>
            <span className={styles['option-text']}>
              {option.label}
              {option.hint && <small>{option.hint}</small>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function CalculatorPage() {
  useDocumentTitle('Калькулятор пошлин');
  useRecordVisit(CALCULATOR_VISIT);
  const [params, setParams] = useSearchParams();
  const schedules = useFeeSchedules();
  const scheduleId = params.get('schedule') ?? undefined;
  const schedule = useFeeSchedule(scheduleId);
  const data = schedule.data;
  const fee = data?.fees.find((item) => item.code === params.get('fee'));
  const group = fee?.group ?? (data && groupsOf(data).find((item) => item === params.get('group')));

  // Each choice is a history entry: the browser's Back button returns to the previous step.
  const choose = (next: Record<string, string>) => setParams(next);

  return (
    <div className={cx(ui['container'], styles['page'])}>
      <Breadcrumbs current="Калькулятор пошлин" />
      <div className={styles['column']}>
        <header className={styles['header']}>
          <h1>Калькулятор пошлин</h1>
          <p className={styles['lead']}>
            Узнайте, сколько стоит зарегистрировать товарный знак или программу для ЭВМ и базу
            данных. Ответьте на несколько вопросов — калькулятор покажет сумму и норму закона, на
            которой она основана.
          </p>
        </header>

        {!schedules.data || (scheduleId && !data) ? (
          <LoadState
            error={schedules.error ?? schedule.error}
            onRetry={() => {
              schedules.reload();
              schedule.reload();
            }}
          />
        ) : (
          <>
            <Step
              number={1}
              title="Для чего нужна пошлина?"
              focus={false}
              chosen={data?.title}
              onReset={() => choose({})}
            >
              <OptionList
                options={schedules.data.map((item) => ({
                  key: item.id,
                  label: item.title,
                  hint: [SCHEDULE_HINTS[item.id], feeKinds(item.feesCount)]
                    .filter(Boolean)
                    .join(' · '),
                  onSelect: () => choose({ schedule: item.id }),
                }))}
              />
            </Step>

            {data && (
              <Step
                number={2}
                title="Выберите раздел"
                focus={!group}
                chosen={group}
                onReset={() => choose({ schedule: data.id })}
              >
                <OptionList
                  options={groupsOf(data).map((item) => ({
                    key: item,
                    label: item,
                    onSelect: () => choose({ schedule: data.id, group: item }),
                  }))}
                />
              </Step>
            )}

            {data && group && (
              <Step
                number={3}
                title="Выберите действие"
                focus={!fee}
                chosen={
                  fee && (
                    <>
                      {fee.name}
                      <small>{fee.reference}</small>
                    </>
                  )
                }
                onReset={() => choose({ schedule: data.id, group })}
              >
                <OptionList
                  options={data.fees
                    .filter((item) => item.group === group)
                    .map((item) => ({
                      key: item.code,
                      label: item.name,
                      hint: item.reference,
                      onSelect: () => choose({ schedule: data.id, group, fee: item.code }),
                    }))}
                />
              </Step>
            )}

            {data &&
              fee &&
              // A fee that depends only on the chosen action is shown at once, without a form.
              (fee.parameters.length ? (
                <FeeCalculator key={`${data.id}:${fee.code}`} schedule={data} fee={fee} />
              ) : (
                <FixedFee key={`${data.id}:${fee.code}`} schedule={data} fee={fee} />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function NumberField({
  parameter,
  value,
  onChange,
}: {
  parameter: FeeParameter;
  value: string;
  onChange: (value: string) => void;
}) {
  const min = parameter.min ?? 1;
  const max = parameter.max ?? 1000;
  const label = parameter.question;
  const id = `fee-${parameter.id}`;
  if (max - min < MAX_SELECT_OPTIONS)
    return (
      <div className={styles['field']}>
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          className={styles['select']}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  const current = Number(value);
  const step = (delta: number) =>
    onChange(
      String(Math.min(max, Math.max(min, (Number.isInteger(current) ? current : min) + delta))),
    );
  return (
    <div className={styles['field']}>
      <label htmlFor={id}>{label}</label>
      <div className={styles['stepper']}>
        <button
          type="button"
          aria-label={`Уменьшить: ${label}`}
          onClick={() => step(-1)}
          disabled={current <= min}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          required
          min={min}
          max={max}
          step={1}
          data-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={`Увеличить: ${label}`}
          onClick={() => step(1)}
          disabled={current >= max}
        >
          +
        </button>
      </div>
      <span className={styles['hint']}>
        От {min} до {max}
      </span>
    </div>
  );
}

function FeeCalculator({ schedule, fee }: { schedule: FeeSchedule; fee: Fee }) {
  const parameters = fee.parameters
    .map((id) => schedule.parameters.find((parameter) => parameter.id === id))
    .filter((parameter): parameter is FeeParameter => Boolean(parameter));
  const [inputs, setInputs] = useState<Record<string, string | boolean | string[]>>(() =>
    Object.fromEntries(
      parameters.map((p) => [p.id, p.type === 'yesNo' ? false : String(p.min ?? 1)]),
    ),
  );
  const [result, setResult] = useState<FeeResult | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const resultHeading = useRef<HTMLHeadingElement>(null);

  // Values per class are entered for as many classes as are chosen (1–45).
  const classInput = Number(inputs[CLASS_COUNT_PARAMETER]);
  const classCount = Number.isInteger(classInput) ? Math.min(Math.max(classInput, 1), 45) : 1;

  // A new result is announced by moving focus to the total.
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);

  const update = (id: string, value: string | boolean | string[]) => {
    setInputs((current) => ({ ...current, [id]: value }));
    setResult(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const invalid = validateForm(event.currentTarget);
    if (invalid) {
      setError(invalid);
      return;
    }
    const values: FeeValues = {};
    for (const parameter of parameters) {
      const input = inputs[parameter.id];
      if (parameter.type === 'yesNo') values[parameter.id] = input === true;
      else if (parameter.type === 'perClass')
        values[parameter.id] = Array.from({ length: classCount }, (_, index) =>
          Number((input as string[] | undefined)?.[index] ?? parameter.min ?? 1),
        );
      else values[parameter.id] = Number(input);
    }
    setError('');
    setPending(true);
    try {
      setResult(await calculateFee(schedule.id, fee.code, values));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <section className={styles['step']} aria-labelledby="step-4">
        <h2 id="step-4" ref={heading} tabIndex={-1}>
          <span className={styles['step-number']}>Шаг 4.</span> Укажите параметры
        </h2>
        <p className={styles['formula']}>
          <strong>Как считается:</strong> {formula(fee)}.
        </p>
        <details className={styles['wording']}>
          <summary>Текст нормы: {fee.reference}</summary>
          <p>{fee.wording}</p>
        </details>

        <form className={styles['form']} noValidate onSubmit={submit}>
          {parameters.map((parameter) => {
            const input = inputs[parameter.id];
            if (parameter.type === 'yesNo')
              return (
                <label key={parameter.id} className={styles['checkbox']}>
                  <input
                    type="checkbox"
                    checked={input === true}
                    onChange={(event) => update(parameter.id, event.target.checked)}
                  />
                  {parameter.question}
                </label>
              );
            if (parameter.type === 'perClass') {
              const list = (input as string[] | undefined) ?? [];
              return (
                <fieldset key={parameter.id} className={styles['per-class']}>
                  <legend>{parameter.question}</legend>
                  <div className={styles['class-grid']}>
                    {Array.from({ length: classCount }, (_, index) => (
                      <label key={index} className={styles['class-field']}>
                        Класс {index + 1}
                        <input
                          type="number"
                          inputMode="numeric"
                          required
                          min={parameter.min}
                          max={parameter.max}
                          step={1}
                          data-label={`Товары и услуги в классе ${index + 1}`}
                          value={list[index] ?? String(parameter.min ?? 1)}
                          onChange={(event) => {
                            const next = [...list];
                            next[index] = event.target.value;
                            update(parameter.id, next);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            }
            return (
              <NumberField
                key={parameter.id}
                parameter={parameter}
                value={String(input ?? '')}
                onChange={(value) => update(parameter.id, value)}
              />
            );
          })}

          {error && (
            <p className={ui['form-error']} role="alert">
              {error}
            </p>
          )}
          <button
            className={cx(ui['button'], ui['primary'], styles['submit'])}
            type="submit"
            aria-disabled={pending}
          >
            {pending ? 'Расчёт…' : 'Рассчитать'}
          </button>
        </form>
      </section>

      {result && <FeeResultView schedule={schedule} result={result} headingRef={resultHeading} />}
    </>
  );
}

function FeeResultView({
  schedule,
  result,
  headingRef,
  wording = false,
}: {
  schedule: FeeSchedule;
  result: FeeResult;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Show the text of the item here when there is no parameters step above. */
  wording?: boolean;
}) {
  return (
    <section className={styles['result']} aria-labelledby="fee-result">
      <p className={styles['result-caption']}>Итого к уплате</p>
      <h2 id="fee-result" className={styles['total']} tabIndex={-1} ref={headingRef}>
        {formatRubles(result.total)}
      </h2>
      {/* A breakdown of a single line would only repeat the total. */}
      {result.lines.length > 1 && (
        <table className={styles['lines']}>
          <caption className="sr-only">Из чего складывается сумма</caption>
          <tbody>
            {result.lines.map((line) => (
              <tr key={line.label}>
                <th scope="row">
                  {line.label}
                  {line.units !== undefined && line.unitAmount !== undefined && (
                    <span>
                      {line.units} × {formatRubles(line.unitAmount)}
                    </span>
                  )}
                </th>
                <td>{formatRubles(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles['basis']}>
        Основание: {result.fee.reference}. {schedule.basis}. Действует с{' '}
        {formatDate(schedule.effectiveFrom)}.
      </p>
      {wording && (
        <details className={styles['wording']}>
          <summary>Текст нормы: {result.fee.reference}</summary>
          <p>{result.fee.wording}</p>
        </details>
      )}
      {schedule.note && <p className={styles['basis']}>{schedule.note}</p>}
      <p className={styles['disclaimer']}>
        Расчёт справочный. Перед оплатой сверьте сумму с{' '}
        <a href={FIPS_CALCULATOR} target="_blank" rel="noopener noreferrer">
          калькулятором пошлин ФИПС
        </a>{' '}
        и реквизитами Роспатента.
        {schedule.reviewedBy && ` Суммы сверены юристом: ${schedule.reviewedBy}.`}
      </p>
    </section>
  );
}

/** A fee that depends only on the chosen action: calculated right away, no form. */
function FixedFee({ schedule, fee }: { schedule: FeeSchedule; fee: Fee }) {
  const [result, setResult] = useState<FeeResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    calculateFee(schedule.id, fee.code, {}).then(
      (value) => active && setResult(value),
      (caught: unknown) => active && setError(caught),
    );
    return () => {
      active = false;
    };
  }, [schedule.id, fee.code, attempt]);

  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);

  if (!result)
    return (
      <LoadState
        error={error ?? undefined}
        onRetry={() => {
          setError(null);
          setAttempt((value) => value + 1);
        }}
      />
    );
  return <FeeResultView schedule={schedule} result={result} headingRef={resultHeading} wording />;
}
