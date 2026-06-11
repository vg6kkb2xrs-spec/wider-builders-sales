import { useState, useRef } from 'react'

export default function AddressInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [showList, setShowList] = useState(false)
  const debounce = useRef(null)

  const search = async (text) => {
    if (text.length < 4) { setSuggestions([]); return }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=us&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      setSuggestions(data)
      setShowList(true)
    } catch {
      setSuggestions([])
    }
  }

  const handleChange = (e) => {
    onChange(e.target.value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(e.target.value), 400)
  }

  const select = (place) => {
    // Format: house number + road + city + state
    const a = place.address
    const parts = [
      a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
      a.city || a.town || a.suburb,
      a.state,
    ].filter(Boolean)
    onChange(parts.join(', '))
    setSuggestions([])
    setShowList(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '123 Ocean Ave, Brooklyn'}
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
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => select(s)}
              style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderBottom: '.5px solid #F2F2F7', color: '#1a1a1a', display: 'flex', alignItems: 'flex-start', gap: 8 }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontWeight: 500 }}>
                  {s.address.house_number} {s.address.road}
                </div>
                <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>
                  {s.address.city || s.address.town || s.address.suburb}, {s.address.state}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
