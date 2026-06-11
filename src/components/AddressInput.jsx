import { useState, useRef, useEffect } from 'react'

export default function AddressInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [showList, setShowList] = useState(false)
  const [ready, setReady] = useState(false)
  const debounce = useRef(null)
  const svcRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const check = setInterval(() => {
      if (window.google?.maps?.places?.AutocompleteService) {
        svcRef.current = new window.google.maps.places.AutocompleteService()
        setReady(true)
        clearInterval(check)
      }
    }, 300)
    return () => clearInterval(check)
  }, [])

  const search = (text) => {
    if (!ready || !svcRef.current || text.length < 3) {
      setSuggestions([]); setShowList(false); return
    }
    svcRef.current.getPlacePredictions(
      { input: text, componentRestrictions: { country: 'us' }, types: ['address'] },
      (preds, status) => {
        if (status === 'OK' && preds?.length) {
          setSuggestions(preds); setShowList(true)
        } else {
          setSuggestions([]); setShowList(false)
        }
      }
    )
  }

  const handleChange = (e) => {
    onChange(e.target.value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(e.target.value), 350)
  }

  const select = (place) => {
    onChange(place.description)
    setSuggestions([]); setShowList(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder || '123 Ocean Ave, Brooklyn'}
        dir="ltr"
        onBlur={() => setTimeout(() => setShowList(false), 200)}
        onFocus={() => suggestions.length > 0 && setShowList(true)}
        style={{ width:'100%', padding:'11px 13px', borderRadius:10, border:'.5px solid #E5E5EA', background:'#F2F2F7', color:'#1a1a1a', fontSize:14, fontFamily:'inherit', textAlign:'left', direction:'ltr' }}
      />
      {showList && suggestions.length > 0 && (
        <div style={{ position:'absolute', top:'100%', right:0, left:0, zIndex:300, background:'#fff', borderRadius:12, border:'.5px solid #E5E5EA', boxShadow:'0 4px 16px rgba(0,0,0,.12)', overflow:'hidden', marginTop:4 }}>
          {suggestions.map(s => (
            <div key={s.place_id} onMouseDown={() => select(s)}
              style={{ padding:'10px 14px', fontSize:13, cursor:'pointer', borderBottom:'.5px solid #F2F2F7', color:'#1a1a1a', display:'flex', alignItems:'flex-start', gap:8, direction:'ltr' }}
            >
              <span style={{ fontSize:16, flexShrink:0 }}>📍</span>
              <div>
                <div style={{ fontWeight:500 }}>{s.structured_formatting?.main_text}</div>
                <div style={{ fontSize:11, color:'#8E8E93', marginTop:1 }}>{s.structured_formatting?.secondary_text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
