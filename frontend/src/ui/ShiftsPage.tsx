import { useState } from 'react'
import { ShiftsCalendar } from './ShiftsCalendar'
import { MyShifts } from './MyShifts'
import { AvailabilityPage } from './AvailabilityPage'

export default function ShiftsPage(){
  const [tab, setTab] = useState<'calendar'|'mine'|'availability'>('calendar')
  return (
    <div className="container">
      <h2>Turni</h2>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button className={tab==='calendar'?'btn':'btn btn-outline'} onClick={()=>setTab('calendar')}>Calendario</button>
        <button className={tab==='mine'?'btn':'btn btn-outline'} onClick={()=>setTab('mine')}>I miei turni</button>
        <button className={tab==='availability'?'btn':'btn btn-outline'} onClick={()=>setTab('availability')}>Disponibilità</button>
      </div>
      {tab==='calendar' && <ShiftsCalendar />}
      {tab==='mine' && <MyShifts />}
      {tab==='availability' && <AvailabilityPage />}
    </div>
  )
}
