import { useEffect, useMemo, useState } from 'react'
import feedbackConfig from './data/feedbackConfig.json'
import './App.css'

const DAILY_LIMIT = 2000

const STORAGE_KEYS = {
  expenses: 'polinka-expenses-v2',
  categories: 'polinka-categories',
}

const VIEW_OPTIONS = [
  { id: 'week', label: 'НЕД' },
  { id: 'month', label: 'МЕС' },
  { id: 'halfYear', label: '6 МЕС' },
  { id: 'year', label: 'ГОД' },
]

const LEVEL_STYLES = {
  safe: {
    color: '#30d158',
    glow: 'rgba(48, 209, 88, 0.28)',
  },
  warning: {
    color: '#ffd60a',
    glow: 'rgba(255, 214, 10, 0.28)',
  },
  elevated: {
    color: '#ff9f0a',
    glow: 'rgba(255, 159, 10, 0.28)',
  },
  danger: {
    color: '#ff453a',
    glow: 'rgba(255, 69, 58, 0.28)',
  },
  critical: {
    color: '#bf5af2',
    glow: 'rgba(191, 90, 242, 0.28)',
  },
}

const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Еда', emoji: '🍜' },
  { id: 'coffee', name: 'Кофе', emoji: '☕️' },
  { id: 'transport', name: 'Транспорт', emoji: '🚕' },
  { id: 'shopping', name: 'Шопинг', emoji: '🛍️' },
  { id: 'fun', name: 'Развлечения', emoji: '🎮' },
  { id: 'home', name: 'Дом', emoji: '🕯️' },
]

const formatMoneyValue = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
})

const weekdayLabel = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
})

const dayLabel = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
})

const monthLabel = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
})

const longDateLabel = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatMoney(amount) {
  return `${formatMoneyValue.format(Math.round(amount))} ₽`
}

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readStorage(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key)
    return rawValue ? JSON.parse(rawValue) : fallbackValue
  } catch {
    return fallbackValue
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function getWeekStart(date) {
  const current = startOfDay(date)
  const day = current.getDay()
  const shift = day === 0 ? -6 : 1 - day
  return addDays(current, shift)
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getMonthDays(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function createExpenseDate(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const currentTime = new Date()
  const hours = currentTime.getHours()
  const minutes = currentTime.getMinutes()
  return new Date(year, month - 1, day, hours, minutes)
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '')
}

function getLevel(amount, multiplier = 1) {
  if (amount >= 3000 * multiplier) {
    return { id: 'critical', title: 'Жесткий перебор' }
  }
  if (amount >= 2200 * multiplier) {
    return { id: 'danger', title: 'Уже красная зона' }
  }
  if (amount >= 2000 * multiplier) {
    return { id: 'elevated', title: 'Лимит пробит' }
  }
  if (amount >= 1500 * multiplier) {
    return { id: 'warning', title: 'Почти край' }
  }
  return { id: 'safe', title: 'Все спокойно' }
}

function createFeedback(total) {
  const level = getLevel(total)
  const config = feedbackConfig[level.id]
  return {
    id: `${level.id}-${Date.now()}`,
    levelId: level.id,
    title: level.title,
    emoji: randomFrom(config.emojis),
    phrase: randomFrom(config.phrases),
    total,
  }
}

function sortExpenses(items) {
  return [...items].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

function buildBuckets(view, expenses, now) {
  let buckets = []
  let rangeLabel = ''

  if (view === 'day') {
    const dayStart = startOfDay(now)
    buckets = Array.from({ length: 8 }, (_, index) => {
      const start = addHours(dayStart, index * 3)
      const end = addHours(dayStart, (index + 1) * 3)
      return {
        id: `day-${index}`,
        label: `${String(index * 3).padStart(2, '0')}:00`,
        shortLabel: `${String(index * 3).padStart(2, '0')}`,
        start,
        end,
        thresholdMultiplier: 3 / 24,
      }
    })
    rangeLabel = longDateLabel.format(now)
  }

  if (view === 'week') {
    const weekStart = getWeekStart(now)
    buckets = Array.from({ length: 7 }, (_, index) => {
      const start = addDays(weekStart, index)
      const end = addDays(start, 1)
      return {
        id: `week-${index}`,
        label: weekdayLabel.format(start).replace('.', ''),
        shortLabel: weekdayLabel.format(start).replace('.', ''),
        start,
        end,
        thresholdMultiplier: 1,
      }
    })
    const weekEnd = addDays(weekStart, 6)
    rangeLabel = `${dayLabel.format(weekStart)} - ${dayLabel.format(weekEnd)} ${weekEnd.getFullYear()}`
  }

  if (view === 'month') {
    const monthStart = getMonthStart(now)
    const daysInMonth = getMonthDays(now)
    buckets = Array.from({ length: daysInMonth }, (_, index) => {
      const start = addDays(monthStart, index)
      const end = addDays(start, 1)
      return {
        id: `month-${index}`,
        label: String(index + 1),
        shortLabel: String(index + 1),
        start,
        end,
        thresholdMultiplier: 1,
      }
    })
    const monthEnd = addDays(monthStart, daysInMonth - 1)
    rangeLabel = `${dayLabel.format(monthStart)} - ${dayLabel.format(monthEnd)} ${monthEnd.getFullYear()}`
  }

  if (view === 'halfYear') {
    const monthStart = getMonthStart(now)
    buckets = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(monthStart.getFullYear(), monthStart.getMonth() - 5 + index, 1)
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      return {
        id: `half-year-${index}`,
        label: monthLabel.format(start).replace('.', ''),
        shortLabel: monthLabel.format(start).replace('.', ''),
        start,
        end,
        thresholdMultiplier: getMonthDays(start),
      }
    })
    const first = buckets[0].start
    const last = addDays(buckets[buckets.length - 1].end, -1)
    rangeLabel = `${monthLabel.format(first).replace('.', '')} - ${monthLabel
      .format(last)
      .replace('.', '')} ${last.getFullYear()}`
  }

  if (view === 'year') {
    const yearStart = new Date(now.getFullYear(), 0, 1)
    buckets = Array.from({ length: 12 }, (_, index) => {
      const start = new Date(yearStart.getFullYear(), index, 1)
      const end = new Date(yearStart.getFullYear(), index + 1, 1)
      return {
        id: `year-${index}`,
        label: monthLabel.format(start).replace('.', ''),
        shortLabel: monthLabel.format(start).replace('.', ''),
        start,
        end,
        thresholdMultiplier: getMonthDays(start),
      }
    })
    rangeLabel = String(now.getFullYear())
  }

  const hydratedBuckets = buckets.map((bucket) => {
    const items = sortExpenses(
      expenses.filter((expense) => {
        const expenseDate = new Date(expense.createdAt)
        return expenseDate >= bucket.start && expenseDate < bucket.end
      }),
    )
    const total = items.reduce((sum, expense) => sum + expense.amount, 0)
    return {
      ...bucket,
      items,
      total,
      level: getLevel(total, bucket.thresholdMultiplier),
    }
  })

  return {
    buckets: hydratedBuckets,
    rangeLabel,
  }
}

function getCategoryBreakdown(items, categoryMap) {
  const grouped = new Map()

  items.forEach((item) => {
    const category = categoryMap.get(item.categoryId) ?? {
      id: item.categoryId,
      name: 'Без категории',
      emoji: '🪩',
    }

    const current = grouped.get(category.id) ?? {
      ...category,
      total: 0,
      count: 0,
    }

    current.total += item.amount
    current.count += 1
    grouped.set(category.id, current)
  })

  return [...grouped.values()].sort((left, right) => right.total - left.total)
}

function getTodayTotal(expenses, now) {
  return expenses.reduce((sum, expense) => {
    const expenseDate = new Date(expense.createdAt)
    return isSameDay(expenseDate, now) ? sum + expense.amount : sum
  }, 0)
}

function getDayTotalForDate(expenses, targetDate) {
  return expenses.reduce((sum, expense) => {
    const expenseDate = new Date(expense.createdAt)
    return isSameDay(expenseDate, targetDate) ? sum + expense.amount : sum
  }, 0)
}

function App() {
  const now = useMemo(() => new Date(), [])
  const [view, setView] = useState('week')
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [composerTab, setComposerTab] = useState('expense')
  const [expenseError, setExpenseError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [categories, setCategories] = useState(() =>
    readStorage(STORAGE_KEYS.categories, DEFAULT_CATEGORIES),
  )
  const [expenses, setExpenses] = useState(() => readStorage(STORAGE_KEYS.expenses, []))
  const [expenseDraft, setExpenseDraft] = useState(() => ({
    amount: '',
    categoryId: DEFAULT_CATEGORIES[0].id,
    note: '',
    date: formatDateInput(new Date()),
  }))
  const [categoryDraft, setCategoryDraft] = useState({
    name: '',
    emoji: '',
  })
  const [selectedBucketId, setSelectedBucketId] = useState('')
  const [feedback, setFeedback] = useState(() => {
    const initialDate = new Date()
    return {
      ...createFeedback(getTodayTotal(expenses, initialDate)),
      isToday: true,
      dateLabel: longDateLabel.format(initialDate),
    }
  })

  useEffect(() => {
    writeStorage(STORAGE_KEYS.categories, categories)
  }, [categories])

  useEffect(() => {
    writeStorage(STORAGE_KEYS.expenses, expenses)
  }, [expenses])

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const viewModel = useMemo(() => buildBuckets(view, expenses, now), [expenses, now, view])

  const activeCategoryId = categories.some((category) => category.id === expenseDraft.categoryId)
    ? expenseDraft.categoryId
    : categories[0]?.id ?? ''

  const currentBucket = viewModel.buckets.find(
    (bucket) => now >= bucket.start && now < bucket.end,
  )

  const fallbackBucket =
    [...viewModel.buckets].reverse().find((bucket) => bucket.total > 0) ??
    currentBucket ??
    viewModel.buckets[viewModel.buckets.length - 1]

  const selectedBucket =
    viewModel.buckets.find((bucket) => bucket.id === selectedBucketId) ?? fallbackBucket

  const selectedBreakdown = useMemo(
    () => getCategoryBreakdown(selectedBucket?.items ?? [], categoryMap),
    [categoryMap, selectedBucket],
  )

  const chartMax = useMemo(() => {
    const totals = viewModel.buckets.map((bucket) => bucket.total)
    const thresholds = viewModel.buckets.map(
      (bucket) => bucket.thresholdMultiplier * DAILY_LIMIT,
    )
    const maxValue = Math.max(...totals, ...thresholds, DAILY_LIMIT)
    return Math.max(2400, Math.ceil(maxValue * 1.08))
  }, [viewModel.buckets])

  const chartGuides = useMemo(
    () => [25, 50, 75],
    [],
  )

  const todayTotal = useMemo(() => getTodayTotal(expenses, now), [expenses, now])
  const feedbackLevelStyle = LEVEL_STYLES[feedback.levelId]
  const chartColumnMinWidth = view === 'month' ? 24 : view === 'year' ? 30 : 38
  const chartBarsWidth = Math.max(
    100,
    viewModel.buckets.length * chartColumnMinWidth,
  )

  const openComposer = () => {
    setIsComposerOpen(true)
    setExpenseDraft((current) => ({
      ...current,
      date: formatDateInput(new Date()),
    }))
  }

  const handleExpenseSubmit = (event) => {
    event.preventDefault()

    const parsedAmount = Number.parseFloat(expenseDraft.amount.replace(',', '.'))
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setExpenseError('Введи нормальную сумму')
      return
    }

    if (!activeCategoryId) {
      setExpenseError('Выбери категорию')
      return
    }

    const expenseDate = createExpenseDate(expenseDraft.date)
    const nextExpense = {
      id: crypto.randomUUID(),
      amount: Math.round(parsedAmount),
      categoryId: activeCategoryId,
      note: expenseDraft.note.trim(),
      createdAt: expenseDate.toISOString(),
    }

    const nextExpenses = sortExpenses([nextExpense, ...expenses])
    const nextDayTotal = getDayTotalForDate(nextExpenses, expenseDate)

    setExpenses(nextExpenses)
    setFeedback({
      ...createFeedback(nextDayTotal),
      isToday: isSameDay(expenseDate, now),
      dateLabel: longDateLabel.format(expenseDate),
    })
    setExpenseError('')
    setIsComposerOpen(false)
    setExpenseDraft({
      amount: '',
      categoryId: activeCategoryId,
      note: '',
      date: formatDateInput(new Date()),
    })
  }

  const handleCategorySubmit = (event) => {
    event.preventDefault()

    const name = categoryDraft.name.trim()
    const emoji = categoryDraft.emoji.trim()

    if (!name || !emoji) {
      setCategoryError('Нужны и название, и смайлик')
      return
    }

    const normalizedName = name.toLowerCase()
    const duplicated = categories.some(
      (category) => category.name.trim().toLowerCase() === normalizedName,
    )

    if (duplicated) {
      setCategoryError('Такая категория уже есть')
      return
    }

    const newCategory = {
      id: `${slugify(name)}-${Date.now().toString(36)}`,
      name,
      emoji,
    }

    setCategories((current) => [...current, newCategory])
    setExpenseDraft((current) => ({
      ...current,
      categoryId: newCategory.id,
    }))
    setComposerTab('expense')
    setCategoryDraft({ name: '', emoji: '' })
    setCategoryError('')
  }

  const handleDeleteExpense = (expenseId) => {
    const nextExpenses = expenses.filter((expense) => expense.id !== expenseId)
    setExpenses(nextExpenses)
    setFeedback({
      ...createFeedback(getTodayTotal(nextExpenses, now)),
      isToday: true,
      dateLabel: longDateLabel.format(now),
    })
  }

  return (
    <>
      <main className="app-shell">
        <section className="segmented-control" aria-label="Период графика">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === view ? 'segment active' : 'segment'}
              onClick={() => setView(option.id)}
            >
              {option.label}
            </button>
          ))}
        </section>

        <section className="summary-panel">
          <p className="summary-label">СЕГОДНЯ</p>
          <p className="summary-value">
            {formatMoney(todayTotal)}
            <span>за сегодня</span>
          </p>
          <p className="summary-range">{longDateLabel.format(now)}</p>
        </section>

        <section className="chart-card">
          <div className="chart-range">{viewModel.rangeLabel}</div>
          <div className="chart-wrap">
            <div className="chart-grid">
              {chartGuides.map((guide) => (
                <div
                  key={guide}
                  className="chart-line"
                  style={{ bottom: `${guide}%` }}
                />
              ))}
              <div className="chart-scroll">
                <div
                  className="chart-bars"
                  style={{
                    minWidth: `${chartBarsWidth}px`,
                    gridTemplateColumns: `repeat(${viewModel.buckets.length}, minmax(${chartColumnMinWidth}px, 1fr))`,
                  }}
                >
                  {viewModel.buckets.map((bucket) => {
                    const height = chartMax > 0 ? (bucket.total / chartMax) * 100 : 0
                    const style = LEVEL_STYLES[bucket.level.id]
                    return (
                      <button
                        key={bucket.id}
                        type="button"
                        className={
                          bucket.id === selectedBucket?.id ? 'bar-column active' : 'bar-column'
                        }
                        onClick={() => setSelectedBucketId(bucket.id)}
                      >
                        <span className="bar-track">
                          <span
                            className="bar-fill"
                            style={{
                              height: bucket.total > 0 ? `${Math.max(height, 3)}%` : '0px',
                              background: style.color,
                              boxShadow: bucket.total > 0 ? `0 0 24px ${style.glow}` : 'none',
                            }}
                          />
                        </span>
                        <span className="bar-label">{bucket.shortLabel}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {selectedBucket ? (
            <div className="detail-panel">
              <div className="detail-header">
                <div>
                  <p className="detail-title">
                    {selectedBucket.label} · {formatMoney(selectedBucket.total)}
                  </p>
                  <p className="detail-subtitle">
                    {longDateLabel.format(selectedBucket.start)}
                  </p>
                </div>
                <div
                  className="status-dot"
                  style={{
                    background: LEVEL_STYLES[selectedBucket.level.id].color,
                    boxShadow: `0 0 18px ${LEVEL_STYLES[selectedBucket.level.id].glow}`,
                  }}
                />
              </div>

              {selectedBreakdown.length > 0 ? (
                <div className="breakdown-list">
                  {selectedBreakdown.map((item) => {
                    const share = selectedBucket.total
                      ? Math.round((item.total / selectedBucket.total) * 100)
                      : 0
                    return (
                      <div key={item.id} className="breakdown-item">
                        <div className="breakdown-main">
                          <span className="breakdown-emoji">{item.emoji}</span>
                          <div>
                            <p>{item.name}</p>
                            <span>
                              {item.count} трат{item.count > 1 ? 'ы' : 'а'} · {share}%
                            </span>
                          </div>
                        </div>
                        <strong>{formatMoney(item.total)}</strong>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="empty-state">
                  В этом интервале пока пусто. Жми плюсик снизу и добавляй траты.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <section
          key={feedback.id}
          className={`feedback-card level-${feedback.levelId}`}
          style={{
            '--feedback-color': feedbackLevelStyle.color,
            '--feedback-glow': feedbackLevelStyle.glow,
          }}
        >
          <div className="feedback-emoji">{feedback.emoji}</div>
          <div>
            <p className="feedback-title">{feedback.title}</p>
            <p className="feedback-phrase">{feedback.phrase}</p>
            <p className="feedback-total">
              {feedback.isToday ? 'Сегодня уже' : `${feedback.dateLabel} уже`} {formatMoney(feedback.total)}
            </p>
          </div>
        </section>

        <section className="expenses-card">
          <div className="expense-list">
            {expenses.length ? (
              expenses.map((expense) => {
                const category = categoryMap.get(expense.categoryId) ?? {
                  name: 'Без категории',
                  emoji: '🪩',
                }
                return (
                  <article key={expense.id} className="expense-item">
                    <div className="expense-main">
                      <span className="expense-emoji">{category.emoji}</span>
                      <div>
                        <p>{category.name}</p>
                        <span>
                          {longDateLabel.format(new Date(expense.createdAt))}
                          {expense.note ? ` · ${expense.note}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="expense-side">
                      <strong>{formatMoney(expense.amount)}</strong>
                      <button
                        type="button"
                        className="expense-delete"
                        aria-label="Удалить трату"
                        onClick={() => handleDeleteExpense(expense.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </article>
                )
              })
            ) : (
              <p className="empty-state">
                Пока пусто. Добавь первую трату через плюсик снизу.
              </p>
            )}
          </div>
        </section>
      </main>

      <button type="button" className="fab-button" onClick={openComposer}>
        <span>+</span>
      </button>

      {isComposerOpen ? (
        <div className="modal-backdrop" onClick={() => setIsComposerOpen(false)}>
          <section
            className="composer-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Добавление</p>
                <h2>Новая запись</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsComposerOpen(false)}
              >
                Закрыть
              </button>
            </div>

            <div className="mini-segments">
              <button
                type="button"
                className={composerTab === 'expense' ? 'mini-segment active' : 'mini-segment'}
                onClick={() => setComposerTab('expense')}
              >
                Трата
              </button>
              <button
                type="button"
                className={composerTab === 'category' ? 'mini-segment active' : 'mini-segment'}
                onClick={() => setComposerTab('category')}
              >
                Категория
              </button>
            </div>

            {composerTab === 'expense' ? (
              <form className="composer-form" onSubmit={handleExpenseSubmit}>
                <label className="field">
                  <span>Сумма</span>
                  <input
                    inputMode="decimal"
                    placeholder="Например 780"
                    value={expenseDraft.amount}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="field">
                  <span>Категория</span>
                  <div className="category-grid">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        className={
                          activeCategoryId === category.id
                            ? 'category-chip active'
                            : 'category-chip'
                        }
                        onClick={() =>
                          setExpenseDraft((current) => ({
                            ...current,
                            categoryId: category.id,
                          }))
                        }
                      >
                        <span>{category.emoji}</span>
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="field">
                  <span>Дата</span>
                  <input
                    type="date"
                    value={expenseDraft.date}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="field">
                  <span>Подпись</span>
                  <input
                    placeholder="Необязательно"
                    value={expenseDraft.note}
                    onChange={(event) =>
                      setExpenseDraft((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </label>

                {expenseError ? <p className="error-text">{expenseError}</p> : null}
                <button type="submit" className="primary-button">
                  Добавить трату
                </button>
              </form>
            ) : (
              <form className="composer-form" onSubmit={handleCategorySubmit}>
                <label className="field">
                  <span>Название</span>
                  <input
                    placeholder="Например книги"
                    value={categoryDraft.name}
                    onChange={(event) =>
                      setCategoryDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Смайлик</span>
                  <input
                    placeholder="📚"
                    value={categoryDraft.emoji}
                    onChange={(event) =>
                      setCategoryDraft((current) => ({
                        ...current,
                        emoji: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="category-preview">
                  <span>{categoryDraft.emoji || '✨'}</span>
                  <p>{categoryDraft.name || 'Новая категория'}</p>
                </div>

                {categoryError ? <p className="error-text">{categoryError}</p> : null}
                <button type="submit" className="primary-button">
                  Сохранить категорию
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  )
}

export default App
