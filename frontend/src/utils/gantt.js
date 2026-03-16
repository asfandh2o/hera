export function computeTaskDates(task) {
  // Use sequential overrides if present (set by layoutTasksSequentially)
  if (task._seq_start && task._seq_end) {
    return { start: new Date(task._seq_start), end: new Date(task._seq_end) }
  }

  const start = task.start_date
    ? new Date(task.start_date)
    : new Date(task.created_at || Date.now())

  let end
  if (task.deadline) {
    end = new Date(task.deadline)
  } else if (task.estimated_hours) {
    const days = Math.max(1, Math.ceil(task.estimated_hours / 8))
    end = new Date(start)
    end.setDate(end.getDate() + days)
  } else {
    end = new Date(start)
    end.setDate(end.getDate() + 1)
  }

  // Ensure end is after start
  if (end <= start) {
    end = new Date(start)
    end.setDate(end.getDate() + 1)
  }

  return { start, end }
}

/**
 * Lay out tasks sequentially — each task starts where the previous one ends.
 * Keeps original order so completed tasks stay in place (just visually muted).
 * Returns a new array of tasks with _seq_start and _seq_end fields.
 */
export function layoutTasksSequentially(tasks) {
  if (!tasks || tasks.length === 0) return []

  // Keep original order — don't reorder by status
  const ordered = [...tasks]

  // First task starts at the earliest original start date
  const firstStart = ordered[0].start_date
    ? new Date(ordered[0].start_date)
    : new Date(ordered[0].created_at || Date.now())
  firstStart.setHours(0, 0, 0, 0)

  let cursor = new Date(firstStart)
  const result = []

  for (const task of ordered) {
    const durationDays = task.estimated_hours
      ? Math.max(1, Math.ceil(task.estimated_hours / 8))
      : task.deadline && task.start_date
        ? Math.max(1, Math.ceil((new Date(task.deadline) - new Date(task.start_date)) / (1000 * 60 * 60 * 24)))
        : 2

    const seqStart = new Date(cursor)
    const seqEnd = new Date(cursor)
    seqEnd.setDate(seqEnd.getDate() + durationDays)

    result.push({
      ...task,
      _seq_start: seqStart,
      _seq_end: seqEnd,
    })

    cursor = new Date(seqEnd)
  }

  return result
}

export function getDateRange(rows, paddingDays = 1) {
  let minDate = null
  let maxDate = null

  for (const row of rows) {
    for (const task of row.tasks) {
      const { start, end } = computeTaskDates(task)
      if (!minDate || start < minDate) minDate = new Date(start)
      if (!maxDate || end > maxDate) maxDate = new Date(end)
    }
  }

  if (!minDate) {
    minDate = new Date()
    maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 14)
  }

  // Add padding
  const startDate = new Date(minDate)
  startDate.setDate(startDate.getDate() - paddingDays)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(maxDate)
  endDate.setDate(endDate.getDate() + paddingDays)
  endDate.setHours(0, 0, 0, 0)

  // Minimum 14 days
  const minEnd = new Date(startDate)
  minEnd.setDate(minEnd.getDate() + 14)
  if (endDate < minEnd) endDate.setTime(minEnd.getTime())

  const days = []
  const cur = new Date(startDate)
  while (cur <= endDate) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }

  return { startDate, endDate, days }
}

export function daysBetween(date1, date2) {
  const d1 = new Date(date1)
  d1.setHours(0, 0, 0, 0)
  const d2 = new Date(date2)
  d2.setHours(0, 0, 0, 0)
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
}

export function getDayColumn(date, rangeStart) {
  return daysBetween(rangeStart, date) + 2 // +2 because col 1 is name column (1-indexed grid)
}

export function isWeekend(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function isToday(date) {
  const today = new Date()
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
}

export function formatShortDate(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[date.getDay()]
}
