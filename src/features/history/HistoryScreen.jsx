import { useState } from 'react'
import { HistoryList } from './HistoryList'
import { HistoryDetail } from './HistoryDetail'

/**
 * Owns list↔detail navigation within the history feature, same local-state
 * convention as App.jsx's top-level screen switching (see EXAMPLES.md) — kept
 * local here rather than in App since it's internal to this one feature.
 */
export function HistoryScreen({ onExit }) {
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  if (selectedSessionId) {
    return (
      <HistoryDetail
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
      />
    )
  }

  return <HistoryList onBack={onExit} onSelect={setSelectedSessionId} />
}
