'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import {
  User, Mail, Phone, CreditCard, MapPin, Calendar, Droplets,
  AlertTriangle, Activity, Pencil, X, Check, Plus, Loader2, Shield,
} from 'lucide-react'

interface PatientProfile {
  id: string
  fullName: string
  email: string
  phone: string | null
  nic: string | null
  address: string | null
  dateOfBirth: string | null
  gender: string | null
  bloodType: string | null
  allergies: string[]
  healthConditions: string[]
  emergencyContact: { name: string; phone: string; relation: string } | null
  penaltyLevel: number
}

type EditableFields = {
  fullName: string
  phone: string
  nic: string
  address: string
  dateOfBirth: string
  gender: string
  bloodType: string
  allergies: string[]
  healthConditions: string[]
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelation: string
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

function calculateAge(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function TagInput({
  tags,
  onChange,
  placeholder,
  color = 'blue',
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
  color?: 'blue' | 'amber' | 'rose'
}) {
  const [input, setInput] = useState('')

  const colorMap = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', hover: 'hover:bg-rose-100' },
  }
  const c = colorMap[color]

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const val = input.trim().replace(/,+$/, '')
      if (val && !tags.includes(val)) {
        onChange([...tags, val])
      }
      setInput('')
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all min-h-[42px]">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${c.bg} ${c.text} border ${c.border}`}
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className={`ml-0.5 ${c.text} opacity-60 hover:opacity-100 transition-opacity`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] text-sm outline-none bg-transparent placeholder:text-gray-300"
      />
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className = '',
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start gap-3 py-3 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm text-gray-800 font-medium">{value || <span className="text-gray-300 font-normal italic">Not set</span>}</div>
      </div>
    </div>
  )
}

export default function PatientProfilePage() {
  const { accessToken } = useAuth()
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<EditableFields>({
    fullName: '',
    phone: '',
    nic: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    bloodType: '',
    allergies: [],
    healthConditions: [],
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  })

  const fetchProfile = useCallback(async () => {
    if (!accessToken) return
    try {
      const data = await apiRequest<PatientProfile>('/api/patients/me', { token: accessToken })
      setProfile(data)
      setForm({
        fullName: data.fullName ?? '',
        phone: data.phone ?? '',
        nic: data.nic ?? '',
        address: data.address ?? '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0]! : '',
        gender: data.gender ?? '',
        bloodType: data.bloodType ?? '',
        allergies: data.allergies ?? [],
        healthConditions: data.healthConditions ?? [],
        emergencyContactName: data.emergencyContact?.name ?? '',
        emergencyContactPhone: data.emergencyContact?.phone ?? '',
        emergencyContactRelation: data.emergencyContact?.relation ?? '',
      })
    } catch (err: any) {
      setError(err.message ?? 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function handleSave() {
    if (!accessToken) return
    setSaving(true)
    setError('')
    try {
      // Only send changed fields
      const payload: Record<string, unknown> = {}
      if (form.fullName !== (profile?.fullName ?? '')) payload.fullName = form.fullName
      if (form.phone !== (profile?.phone ?? '')) payload.phone = form.phone || undefined
      if (form.nic !== (profile?.nic ?? '')) payload.nic = form.nic || undefined
      if (form.address !== (profile?.address ?? '')) payload.address = form.address || undefined
      if (form.dateOfBirth !== (profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0]! : '')) payload.dateOfBirth = form.dateOfBirth || undefined
      if (form.gender !== (profile?.gender ?? '')) payload.gender = form.gender || undefined
      if (form.bloodType !== (profile?.bloodType ?? '')) payload.bloodType = form.bloodType || undefined
      if (JSON.stringify(form.allergies) !== JSON.stringify(profile?.allergies ?? [])) payload.allergies = form.allergies
      if (JSON.stringify(form.healthConditions) !== JSON.stringify(profile?.healthConditions ?? [])) payload.healthConditions = form.healthConditions

      // Emergency contact — send if any field changed
      const ecChanged =
        form.emergencyContactName !== (profile?.emergencyContact?.name ?? '') ||
        form.emergencyContactPhone !== (profile?.emergencyContact?.phone ?? '') ||
        form.emergencyContactRelation !== (profile?.emergencyContact?.relation ?? '')
      if (ecChanged && (form.emergencyContactName || form.emergencyContactPhone)) {
        payload.emergencyContact = {
          name: form.emergencyContactName,
          phone: form.emergencyContactPhone,
          relation: form.emergencyContactRelation,
        }
      }

      if (Object.keys(payload).length > 0) {
        await apiRequest('/api/patients/me', {
          method: 'PUT',
          body: payload,
          token: accessToken,
        })
      }
      await fetchProfile()
      setEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (!profile) return
    setForm({
      fullName: profile.fullName ?? '',
      phone: profile.phone ?? '',
      nic: profile.nic ?? '',
      address: profile.address ?? '',
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0]! : '',
      gender: profile.gender ?? '',
      bloodType: profile.bloodType ?? '',
      allergies: profile.allergies ?? [],
      healthConditions: profile.healthConditions ?? [],
      emergencyContactName: profile.emergencyContact?.name ?? '',
      emergencyContactPhone: profile.emergencyContact?.phone ?? '',
      emergencyContactRelation: profile.emergencyContact?.relation ?? '',
    })
    setEditing(false)
    setError('')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-sm text-gray-600 font-medium">Could not load profile</p>
        <p className="text-xs text-gray-400 mt-1">{error || 'Please try again later'}</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6" style={{ scrollbarWidth: 'none' }}>
      <div className="max-w-2xl mx-auto space-y-5 pb-10">

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-[#1A73E8] via-[#4C8BF5] to-[#7BAAF7] relative">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23fff\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")', backgroundSize: '24px 24px' }} />
          </div>
          <div className="px-5 pb-5 -mt-10 relative">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center text-2xl font-bold text-[#1A73E8] bg-gradient-to-br from-blue-50 to-white">
                {profile.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h2 className="text-lg font-bold text-gray-900 truncate">{profile.fullName}</h2>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {profile.email}
                </p>
              </div>
              <button
                onClick={() => editing ? handleCancel() : setEditing(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  editing
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-[#1A73E8] text-white hover:bg-[#1565C0] shadow-sm'
                }`}
              >
                {editing ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
              </button>
            </div>
          </div>
        </div>

        {/* Success / Error banners */}
        {saveSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium animate-fade-in">
            <Check className="w-4 h-4" /> Profile updated successfully
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* ─── VIEW MODE ──────────────────────────────────────────── */}
        {!editing ? (
          <>
            {/* Personal Information */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Information</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow icon={User} label="Full Name" value={profile.fullName} />
                <InfoRow icon={Phone} label="Phone" value={profile.phone} />
                <InfoRow icon={CreditCard} label="NIC" value={profile.nic} />
                <InfoRow icon={MapPin} label="Address" value={profile.address} />
                <InfoRow icon={Calendar} label="Date of Birth" value={
                  profile.dateOfBirth
                    ? `${new Date(profile.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (${calculateAge(profile.dateOfBirth)} years)`
                    : null
                } />
                <InfoRow icon={User} label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : null} />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergency Contact</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow icon={Shield} label="Contact Name" value={profile.emergencyContact?.name} />
                <InfoRow icon={Phone} label="Contact Phone" value={profile.emergencyContact?.phone} />
                <InfoRow icon={User} label="Relationship" value={profile.emergencyContact?.relation} />
              </div>
            </div>

            {/* Medical Information */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Medical Information</h3>
              <div className="divide-y divide-gray-50">
                <InfoRow icon={Droplets} label="Blood Group" value={
                  profile.bloodType
                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-100">{profile.bloodType}</span>
                    : null
                } />
                <InfoRow icon={AlertTriangle} label="Allergies" value={
                  profile.allergies?.length > 0
                    ? <div className="flex flex-wrap gap-1.5">
                        {profile.allergies.map((a) => (
                          <span key={a} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">{a}</span>
                        ))}
                      </div>
                    : null
                } />
                <InfoRow icon={Activity} label="Health Conditions" value={
                  profile.healthConditions?.length > 0
                    ? <div className="flex flex-wrap gap-1.5">
                        {profile.healthConditions.map((c) => (
                          <span key={c} className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">{c}</span>
                        ))}
                      </div>
                    : null
                } />
              </div>
            </div>
          </>
        ) : (
          /* ─── EDIT MODE ──────────────────────────────────────────── */
          <>
            {/* Personal Information (editable) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Personal Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+94771234567"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">NIC</label>
                    <input
                      type="text"
                      value={form.nic}
                      onChange={(e) => setForm({ ...form, nic: e.target.value })}
                      placeholder="National ID number"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Address</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Home address"
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Date of Birth</label>
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Gender</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all bg-white"
                    >
                      <option value="">Select gender</option>
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Information (editable) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Medical Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Blood Group</label>
                  <div className="flex flex-wrap gap-2">
                    {BLOOD_TYPES.map((bt) => (
                      <button
                        key={bt}
                        type="button"
                        onClick={() => setForm({ ...form, bloodType: form.bloodType === bt ? '' : bt })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          form.bloodType === bt
                            ? 'bg-red-50 text-red-600 border-red-300 shadow-sm ring-2 ring-red-100'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Allergies</label>
                  <TagInput
                    tags={form.allergies}
                    onChange={(tags) => setForm({ ...form, allergies: tags })}
                    placeholder="Type an allergy and press Enter"
                    color="amber"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Health Conditions</label>
                  <TagInput
                    tags={form.healthConditions}
                    onChange={(tags) => setForm({ ...form, healthConditions: tags })}
                    placeholder="Type a condition and press Enter"
                    color="rose"
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact (editable) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Emergency Contact</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Contact Name</label>
                  <input
                    type="text"
                    value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                    placeholder="Full name"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Contact Phone</label>
                    <input
                      type="tel"
                      value={form.emergencyContactPhone}
                      onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                      placeholder="+94771234567"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Relationship</label>
                    <input
                      type="text"
                      value={form.emergencyContactRelation}
                      onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                      placeholder="e.g. Spouse, Parent, Sibling"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={handleCancel}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.fullName.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1A73E8] rounded-xl hover:bg-[#1565C0] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
