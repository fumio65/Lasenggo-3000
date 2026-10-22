import { useEffect, useState } from 'react'
import { HistoryList } from './HistoryList'
import { HistoryDetail } from './HistoryDetail'

/**
 * Owns list↔detail navigation within the history feature, same local-state
 * convention as App.jsx's top-level screen switching (see EXAMPLES.md) — kept
 * local here rather than in App since it's internal to this one feature.
 */
export function HistoryScreen({ onExit, onResume }) {
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  // UX fix: same root cause as App.jsx's top-level scroll reset — switching
  // to the detail view while scrolled down the list left the detail screen
  // scrolled to that same offset, since there's no real page nav to reset it.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [selectedSessionId])

  if (selectedSessionId) {
    return (
      <HistoryDetail
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
        onResume={onResume}
      />
    )
  }

  return <HistoryList onBack={onExit} onSelect={setSelectedSessionId} />
}
