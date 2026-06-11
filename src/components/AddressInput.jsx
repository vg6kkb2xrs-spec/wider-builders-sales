import { useState, useRef, useCallback } from 'react'

export default function AddressInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [showList, setShowList] = useState(false)
  const debounce = useRef(null)

  const search = useCallback(async (text) => {
    if (text.length < 3) { setSuggestions([]); setShowList(false); return }
    try {
      const { AutocompleteSuggestion } = await window.google.maps.importLibrary('places')
      const req = {
        input: text,
        includedRegionCodes: ['us'],
        locationBias: { center: { lat: 40.7128, lng: -74.006 }, radius: 80000 },
      }
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(req)
      setSuggestions(results || [])
      setShowList(true)
    } catch (e) {
      console.error('Places error:', e)
      setSuggestions([])
    }
  }, [])

  const handleChange = (e) => {
    onChange(e.target.value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(e.target.value), 350)
  }

  const select = (s) => {
    const text = s.placePrediction?.text?.toString() || s.placePrediction?.mainText?.toString() || ''
    onChange(text)
    setSuggestions([])
    setShowList(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder || 'כתובת הפרויקט'}
        onBlur={() => setTimeout(() => setShowList(false), 150)}
        onFocus={() => suggestions.length > 0 && setShowList(true)}
        style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: '.5px solid #E5E5EA', background: '#F2F2F7', color: '#1a1a1a', fontSize: 14, fontFamily: 'inherit' }}
      />
      {showList && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 300,
          background: '#fff', borderRadius: 12, border: '.5px solid #E5E5EA',
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', overflow: 'hidden', marginTop: 4
        }}>
          {suggestions.map((s, i) => {
            const main = s.placePrediction?.mainText?.toString() || ''
            const secondary = s.placePrediction?.secondaryText?.toString() || ''
            return (
              <div key={i} onMouseDown={() => select(s)}
                style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderBottom: '.5px solid #F2F2F7', color: '#1a1a1a', display: 'flex', alignItems: 'flex-start', gap: 8 }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
                <div>
                  <div style={{ fontWeight: 500 }}>{main}</div>
                  <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>{secondary}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
