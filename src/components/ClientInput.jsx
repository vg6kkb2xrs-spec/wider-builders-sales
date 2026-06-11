import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ClientInput({ name, phone, onChangeName, onChangePhone }) {
  const [suggestions, setSuggestions] = useState([])
  const [showList, setShowList] = useState(false)
  const debounce = useRef(null)

  const search = async (text) => {
    if (text.length < 2) { setSuggestions([]); setShowList(false); return }
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('agent_id', user.id)
      .ilike('name', `%${text}%`)
      .limit(5)
    if (data?.length) { setSuggestions(data); setShowList(true) }
    else { setSuggestions([]); setShowList(false) }
  }

  const select = (client) => {
    onChangeName(client.name)
    onChangePhone(client.phone || '')
    setSuggestions([]); setShowList(false)
  }

  const saveClient = async (n, p) => {
    if (!n.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    // upsert — אם כבר קיים אותו שם, לא נוצר כפיל
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('agent_id', user.id)
      .ilike('name', n.trim())
      .single()
    if (!existing) {
      await supabase.from('clients').insert({ name: n.trim(), phone: p.trim(), agent_id: user.id })
    }
  }

  return (
    <div>
      {/* שם לקוח */}
      <div className="field">
        <label>שם הלקוח *</label>
        <div style={{ position: 'relative' }}>
          <input
            placeholder="John Smith"
            value={name}
            onChange={e => {
              onChangeName(e.target.value)
              clearTimeout(debounce.current)
              debounce.current = setTimeout(() => search(e.target.value), 300)
            }}
            onBlur={() => setTimeout(() => setShowList(false), 200)}
            onFocus={() => suggestions.length > 0 && setShowList(true)}
          />
          {showList && suggestions.length > 0 && (
            <div style={{ position:'absolute', top:'100%', right:0, left:0, zIndex:300, background:'#fff', borderRadius:12, border:'.5px solid #E5E5EA', boxShadow:'0 4px 16px rgba(0,0,0,.12)', overflow:'hidden', marginTop:4 }}>
              {suggestions.map(c => (
                <div key={c.id} onMouseDown={() => select(c)}
                  style={{ padding:'10px 14px', fontSize:13, cursor:'pointer', borderBottom:'.5px solid #F2F2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                >
                  <div>
                    <div style={{ fontWeight:500, color:'#1a1a1a' }}>{c.name}</div>
                    {c.phone && <div style={{ fontSize:11, color:'#8E8E93', marginTop:1 }}>📞 {c.phone}</div>}
                  </div>
                  <span style={{ fontSize:11, color:'#1D9E75' }}>בחר</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* טלפון */}
      <div className="field">
        <label>טלפון</label>
        <input
          placeholder="+1 718 555 0100"
          type="tel"
          value={phone}
          onChange={e => onChangePhone(e.target.value)}
          onBlur={() => saveClient(name, phone)}
        />
      </div>
    </div>
  )
}
