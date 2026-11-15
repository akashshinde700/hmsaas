'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  X,
  ArrowLeft,
  ArrowRight,
  Plus,
  Stethoscope,
} from 'lucide-react'
import Link from 'next/link'

interface Appointment {
  id: string
  patient: { id: string; uhid: string; name: string; phone: string; ageYears?: number | null; gender?: string }
  doctor: { id: string; name: string; specialization?: string } | null
  appointmentDate: string
  slotTime: string
  type: string
  reason?: string | null
  status: string
}

interface AppointmentCalendarProps {
  organizationId: string
  doctorId?: string
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  checked_in: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  completed: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  cancelled: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  no_show: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
}

export function AppointmentCalendar({ organizationId, doctorId }: AppointmentCalendarProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'day' | 'week'>('week')
  const [updateStatus, setUpdateStatus] = useState<{ id: string; status: string } | null>(null)

  const dateStr = selectedDate.toISOString().split('T')[0]

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      const url = new URL(`/api/doctor/appointments`, window.location.origin)
      url.searchParams.set('orgId', organizationId)
      if (doctorId) url.searchParams.set('doctorId', doctorId)
      url.searchParams.set('date', dateStr)

      const res = await fetch(url.toString())
      const data = await res.json()
      setAppointments(data.appointments || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [organizationId, doctorId, dateStr])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Optimistic status update
  useEffect(() => {
    if (!updateStatus) return
    ;(async () => {
      try {
        await fetch(`/api/doctor/appointments/${updateStatus.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: updateStatus.status, orgId: organizationId }),
        })
        setAppointments((prev) =>
          prev.map((a) => (a.id === updateStatus.id ? { ...a, status: updateStatus.status } : a))
        )
      } catch {
        // silent
      } finally {
        setUpdateStatus(null)
      }
    })()
  }, [updateStatus, organizationId])

  const prevDay = () => setSelectedDate((d) => { d.setDate(d.getDate() - 1); return d })
  const nextDay = () => setSelectedDate((d) => { d.setDate(d.getDate() + 1); return d })
  const today = () => setSelectedDate(new Date())

  const dayLabel = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  // Group appointments by hour slot
  const slots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']
  const apptBySlot: Record<string, Appointment[]> = {}
  slots.forEach((s) => {
    apptBySlot[s] = appointments.filter((a) => a.slotTime === s)
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Calendar className="h-5 w-5" />
          </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Doctor Calendar</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                OPD appointments · {view === 'week' ? 'Week view' : 'Day view'}
              </p>
            </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={prevDay}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={today}
            className="rounded-lg px-3 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-sm shadow-teal-200/40"
          >
            Today
          </button>
          <button
            type="button"
            onClick={nextDay}
            className="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-slate-900 dark:text-white px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {dayLabel(selectedDate)}
          </span>
          <button
            type="button"
            onClick={() => setView((v) => (v === 'day' ? 'week' : 'day'))}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
          >
            {view === 'week' ? 'Day View' : 'Week View'}
          </button>
          <Link
            href="/doctor/workspace"
            className="rounded-lg px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm shadow-indigo-200/40 flex items-center gap-1.5"
          >
            <Plus className="h-3 w-3" /> Workspace
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-teal-200 border-t-teal-600 dark:border-teal-800 dark:border-t-teal-400" />
        </div>
      ) : (
        <>
          {/* Week Grid */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="grid grid-cols-9 border-r border-slate-200 dark:border-slate-700">
              {/* Time column */}
              <div className="border-r border-slate-200 dark:border-r-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-2">
                <div className="flex flex-col h-full justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {slots.map((slot) => (
                    <div key={slot} className="text-center mb-1">
                      {slot}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day columns */}
              <div className="grid grid-cols-1 gap-0">
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const d = new Date(selectedDate)
                  d.setDate(d.getDate() - selectedDate.getDay() + offset)
                  const isToday = d.toDateString() === new Date().toDateString()
                  const dayAppts = appointments.filter(
                    (a) => new Date(a.appointmentDate).toDateString() === d.toDateString()
                  )

                  return (
                    <div
                      key={offset}
                      className={`border-r border-slate-200 dark:border-r-slate-700 border-t border-slate-200 dark:border-t-slate-700 ${
                        isToday ? 'bg-teal-50 dark:bg-teal-900/10' : ''
                      }`}
                    >
                      <div className="p-3 border-b border-slate-200 dark:border-b-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-sm font-bold ${isToday ? 'text-teal-700 dark:text-teal-400' : 'text-slate-900 dark:text-white'}`}>
                            {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isToday ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {d.getDate()}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>

                      <div className="p-2 h-[calc(100%-72px)] overflow-y-auto flex flex-col gap-1">
                        {dayAppts.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-600 italic">
                            Free
                          </div>
                        ) : (
                          dayAppts.map((appt) => (
                            <div
                              key={appt.id}
                              onClick={() =>
                                setUpdateStatus({
                                  id: appt.id,
                                  status:
                                    appt.status === 'scheduled' ? 'checked_in' : appt.status === 'checked_in' ? 'completed' : 'scheduled',
                                })
                              }
                              className={`cursor-pointer rounded-lg border p-2 ${STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled} text-xs font-bold transition`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold">{appt.patient.name}</span>
                                <span className="text-[10px] opacity-80">{appt.slotTime}</span>
                              </div>
                              <div className="text-[10px] opacity-90">{appt.patient.uhid}</div>
                              <div className="text-[10px] opacity-75 mt-0.5">{appt.type}</div>
                              <div className="mt-1 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 fill-current" />
                                <span className="text-[10px]">{appt.status}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px]">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1">
                <span className={`rounded-full border w-2 h-2 ${color.split(' ')[0]} ${color.split(' ')[1]}`} />
                <span className="text-slate-500 dark:text-slate-400 capitalize">{status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
