# MediQueue — Project Description

*Medical-center queue & appointment platform · Repo: QueueManagementProto*

---

## 1. The Idea

**MediQueue** is a web platform for medical centers that brings everything around a clinic visit into one system: appointment booking, walk-in queue management, doctor location tracking, patient health history, and real-time clinic updates.

Its defining principle is that it serves **tech-savvy and non-tech-savvy patients equally**. A patient with a smartphone can book online and track their doctor live; a patient who simply walks in — no app, no account, no internet — is still handled through the same system by the receptionist and can get an SMS when it's their turn. Nobody is left out.

---

## 2. The Problems It Solves

The whole product is designed around six concrete clinic pain points:

| Problem | Solution |
|---|---|
| Overbooking and wasted slots | Fixed slots per hour with atomic counters — double-booking is impossible |
| Repeat no-shows | Automated, tiered penalty system |
| Patients who don't use apps | Receptionist-run walk-in queue with SMS-only / verbal notifications |
| Doctors buried in admin work | Voice notes, one-click templates, auto prescription PDFs, AI visit summaries |
| Patients not knowing if a doctor is delayed | Live doctor location map + real-time delay broadcasts |
| No central health history | Unified patient records timeline with file attachments |

---

## 3. Who Uses It — The Five Roles

The app is organized around five user types, which map directly to route groups in the code.

**Patients** — browse doctors, book appointments, see live doctor location, subscribe to a doctor for delay alerts, view their health history and past prescriptions, and receive reminders. Additional features include a clinic finder and favorite clinics.

**Non-tech-savvy patients** — walk directly into the clinic, get a queue number (printed or verbal), and optionally receive an SMS when their turn is near. No app, no login, no internet needed on their end.

**Doctors** — manage their schedule and slots, run their patient queue, dictate visit notes instead of typing, use one-click templates for common conditions, auto-generate prescription PDFs, and get AI-drafted visit summaries to review rather than write.

**Receptionists** — manage the walk-in queue from a single dashboard, call the next patient with one button, and drive the clinic's public TV screen.

**Admins & System Admins** — configure slots per doctor, view no-show and utilization statistics, and manage doctors, clinics, and staff. A separate **System Admin** tier handles account bans/suspensions, role escalation, platform-wide statistics, login & audit logging, and maintenance mode.

There is also a **public TV display screen** per clinic (`/display/[clinicId]`) that requires no authentication and updates live as the queue changes.

---

## 4. What's Being Built — The Two Flagship Journeys

The prototype proves out two end-to-end journeys:

1. **Walk-in queue.** A receptionist adds a patient who walked in (name + optional phone, no account). The TV screen updates live. The doctor calls the next patient from their dashboard and the screen refreshes instantly. The patient gets an SMS when called.

2. **Appointment booking.** A patient browses doctors, picks a time slot, and confirms. The system blocks double-booking, and a penalty warning appears if the patient has a history of no-shows.

---

## 5. Tech Stack (Current)

MediQueue is a **Turborepo monorepo** using npm workspaces.

**Frontend / App**
- **Next.js 16** (App Router) + **TypeScript** — SSR, file-based routing, server actions
- **Tailwind CSS** + **shadcn/ui** + **Radix UI** — accessible, composable UI
- **TanStack Query** — server state, caching, background refetch
- **MapLibre GL** — live doctor/clinic maps (open-source; replaced the originally planned Mapbox)
- **Socket.IO client** — real-time updates
- **Web Speech API** — doctor voice dictation (browser-native)
- **recharts**, **jsPDF**, **html2canvas** — dashboards, charts, and client-side PDF/export

**Backend / Data**
- **Supabase** — the backend and data layer (PostgreSQL + auth/storage). The web app talks to Supabase directly through **Next.js server actions** (`@supabase/ssr`).
- **bcryptjs** for password hashing, UUIDs for IDs.

**Infrastructure**
- **Turborepo** monorepo, **GitHub Actions** for CI, hosted on a managed platform (e.g. Vercel + Supabase). **No Docker.**

### Monorepo layout

```
QueueManagementProto/
├── apps/
│   ├── web/          ← Next.js 16 frontend (Supabase server actions)
│   │   └── app/
│   │       ├── (auth)/           login, register
│   │       ├── (patient)/        book, appointments, clinic-finder, favorites, profile
│   │       ├── (doctor)/         schedule, queue
│   │       ├── (receptionist)/   queue
│   │       ├── (admin)/          admin (doctors, staff, queue, medi-center)
│   │       │                     + system-admin (dashboard, accounts, roles)
│   │       └── display/[clinicId]  ← public TV queue screen (no auth)
│   └── api/          ← legacy Fastify backend (superseded by Supabase; not the current path)
├── packages/
│   ├── types/        ← shared TypeScript interfaces
│   ├── schemas/      ← shared Zod validation schemas
│   └── ui/           ← shared design-system components
└── (eslint-config, typescript-config)
```

> **Note on history:** The original plan documents (PROJECT_PLAN.md, PROTOTYPE_ROADMAP.txt, README) describe a self-hosted **Fastify + PostgreSQL + Redis + Docker Compose** stack with Mapbox. The project has since moved to **Supabase**, Docker support was removed, and maps switched to MapLibre. The `apps/api` Fastify code still exists in the repo but is no longer the active backend. This document reflects the current Supabase-based reality.

---

## 6. Data Model

The system spans roughly 18–23 tables. Core entities:

- **users** — base auth for all roles (`system_admin`, `doctor`, `patient`, `receptionist`)
- **doctors** — profile, specialization, slots-per-hour, working hours
- **patients** — profile, blood type, allergies, emergency contact
- **clinics** + **doctor_clinics** — physical locations and doctor↔clinic many-to-many
- **doctor_slots** — hour-level availability with capacity and booked count
- **appointments** — bookings with status and slot position
- **penalty_profiles** — no-show / late-cancel tracking and penalty level
- **waitlist** — queue for fully-booked slots
- **health_records**, **prescriptions**, **appointment_templates** — clinical history and doctor shortcuts
- **doctor_locations**, **doctor_subscriptions** — live location and patient follow
- **walk_in_queue** — the physical queue (name + optional phone, no account required)
- **video_rooms**, **ratings**, **notifications**, **insurance_verifications**
- **account_bans**, **system_audit_log**, **login_audit_log**, **system_settings**, **statistics** — the system-admin layer

---

## 7. The Clever Bits — Core Logic

**No overbooking.** Slot reservation is atomic — a check-and-increment guarded so that under concurrent load exactly one booking wins for a limited-capacity slot.

**Tiered penalty system.** Four levels:

| Level | Trigger | Effect |
|---|---|---|
| 0 | Default | No restriction |
| 1 | ≥2 no-shows OR ≥3 late cancels | Warning shown during booking |
| 2 | ≥3 no-shows OR ≥5 late cancels | Auto-assigned the last slot position ("late number") |
| 3 | ≥5 no-shows | Booking suspended for 7 days |

Penalties auto-expire after a stretch of good behavior, and admins can reset them manually. A background job detects no-shows and recalculates levels automatically.

**Walk-in queue math.** Queue numbers auto-increment per doctor per day; estimated wait = patients-ahead × average consultation time. Adding or calling a patient broadcasts a live update to the clinic's TV screen.

**Doctor automation.** Auto-generated slots from working hours; voice-to-text visit notes; one-click template pre-fill; auto prescription PDFs emailed to patients; and AI-drafted visit summaries the doctor reviews rather than writes.

**Real-time everywhere.** Socket.IO rooms per doctor, per clinic queue, and per user push events — covering location updates, delay broadcasts, slot changes, queue changes, and reminders.

---

## 8. Full Feature List

**Core**
- Fixed appointment slots per hour (configurable per doctor)
- Atomic slot reservation — no overbooking
- Tiered penalty system for repeat no-shows (4 levels)
- Physical walk-in queue — no patient account required
- Public TV queue display per clinic
- SMS notifications for walk-in patients
- Live doctor location map + subscribe for delay alerts
- Patient health-records timeline and booking history

**Doctor automation**
- Voice-to-text visit notes
- Quick-fill templates for common conditions
- One-click follow-up scheduling
- AI-generated visit summaries (doctor reviews)
- Auto prescription PDF generation + email
- Auto slot generation from working hours

**Additional**
- Telemedicine / video consultation
- Structured prescription management (printable PDFs)
- Waitlist for fully-booked slots
- Post-appointment patient ratings (1–5 stars)
- Multi-clinic / branch support
- Insurance verification workflow
- WhatsApp / SMS notifications for non-app patients
- In-app notification center + web push
- Audit log for HIPAA readiness
- OAuth sign-up for patients

**System administration** (implemented)
- Account bans / suspensions (permanent or with expiry), enforced at auth level
- Role escalation / demotion with audit logging
- Platform-wide usage statistics across multiple periods, with charts and export
- System audit log + login audit log (IP, user-agent, success/failure)
- Maintenance mode toggle with custom message and estimated downtime

---

## 9. Implementation Phases

The build is staged in roughly ten phases:

0. **Foundation** — monorepo, auth, roles, shared types/schemas
1. **Appointment booking core** — slot generation, atomic booking, booking UI, waitlist
2. **Penalty system** — no-show detection, late-cancel detection, penalty-aware booking
3. **Walk-in queue** — receptionist form, queue board, public TV display, SMS
4. **Doctor location & map** — live location, subscriptions, delay broadcasts
5. **Health records & doctor automation** — records, voice notes, templates, AI summaries, prescriptions
6. **Telemedicine / video** — in-browser consultations
7. **Multi-clinic, ratings & insurance**
8. **Notifications, reminders & WhatsApp** — multi-channel proactive comms
9. **Admin dashboard & production hardening** — stats, security, load testing, accessibility

---

## 10. Future Roadmap

- **Mobile app** (React Native, reusing shared types/schemas)
- **AI symptom checker** — suggests a specialization before booking
- **Lab integration** — HL7 FHIR ingestion of lab results into health records
- **Billing module** — per-consultation invoicing and payments
- **Staff rostering** — doctor leave and receptionist shift scheduling

---

*Reflects the current Supabase-based architecture. Some legacy plan documents in this repo still describe the earlier Docker/Fastify design and are out of date.*
