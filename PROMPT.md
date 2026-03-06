RMK-TransitGo — Cursor Build Prompt

Build the complete RMK-TransitGo React Native (Expo) app from scratch following the .cursorrules file exactly. Build one screen at a time, fully — do not scaffold or leave placeholders.



STEP 1 — Project Setup

Run the following:

npx create-expo-app RMK-TransitGo --template expo-template-blank-typescript
cd RMK-TransitGo
npx expo install expo-router expo-location react-native-maps
npm install @supabase/supabase-js react-native-url-polyfill
npm install @expo-google-fonts/dm-sans @expo-google-fonts/dm-mono expo-font
npm install lucide-react-native

Create .env:

EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

Create lib/supabase.ts:

import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

Create constants/theme.ts with the full Colors object from .cursorrules.
Create lib/types.ts with all interfaces from .cursorrules.



STEP 2 — Welcome Screen (app/(auth)/welcome.tsx)

What it looks like (Cityflo-inspired):





Background: #FAFAF8



Top section:





Small app icon (bus emoji in a #F5C518 rounded square, 44×44)



App name: RMK-TransitGo in DM Sans Bold, 22px, #111111



Subtitle: "Campus Transport System" in DM Sans, 13px, #888888



Hero section:





Large heading: "Your campus, on the move." — DM Sans ExtraBold, 34px, #111111, tight line-height



Subtext: "Real-time bus tracking for RMK College" — DM Sans, 14px, #888888



Role selection cards (3 cards, full width, stacked):





White card, border-radius:20, border #EEEEEE, shadow



Left: icon in yellow rounded square (44×44) + role name (DM Sans Bold 15px) + description (DM Sans 12px #888888)



Right: chevron icon (#CCCCCC)



Cards: 🎓 Student — "Track your bus, signal driver" | 🚌 Driver — "Manage trips, view alerts" | 🛠️ Admin — "Manage fleet, routes & logs"



Yellow decorative blob shape in top-right background (use absolute positioned View with border-radius and #F5C518 opacity 0.12)

Behaviour:





Tapping a role card navigates to the correct auth screen passing role as a param



router.push('/(auth)/student-auth') | /(auth)/driver-auth | /(auth)/admin-auth



STEP 3 — Auth Screens

Student Auth (app/(auth)/student-auth.tsx)

Sign In tab fields: Email, Password
Sign Up tab fields: Full Name, College Email, Roll Number, Bus Number (label: "Bus Number e.g. Bus 5"), Bus Stop (dropdown: RMK College Gate / Thiruvallur Junction / Ambattur OT / Anna Nagar / Koyambedu), Password

Sign Up Supabase logic:

// 1. Create auth user
const { data, error } = await supabase.auth.signUp({ email, password })

// 2. Insert into profiles
await supabase.from('profiles').insert({
  id: data.user.id,
  full_name: name,
  role: 'student'
})

// 3. Insert into students
await supabase.from('students').insert({
  id: data.user.id,
  roll_number: rollNumber,
  bus_number: busNumber,
  bus_stop: busStop,
  email: email
})

Sign In Supabase logic:

const { data, error } = await supabase.auth.signInWithPassword({ email, password })
// On success → router.replace('/(student)/')

UI:





Back arrow top left (navigates to welcome)



Role badge top right: "🎓 Student" pill (yellow bg, black text, rounded)



Toggle tabs at top: Sign In | Sign Up — yellow underline on active tab



All inputs: white background, #EEEEEE border, 12px radius, DM Sans 14px, #111111 text



Bus Stop rendered as a styled Picker or custom modal selector (not a native HTML select)



Primary button: full width, #1A1A1A background, white DM Sans Bold text, 14px radius



Loading spinner inside button while Supabase call is in progress



Error message shown in red below the button if Supabase returns an error

Driver Auth (app/(auth)/driver-auth.tsx)

Sign Up fields: Full Name, Email, Employee ID (label: "Employee ID e.g. EMP-0042"), Bus Number (label: "Bus Number e.g. Bus 5"), Number Plate (label: "Number Plate e.g. TN09 AB 1234"), Password

Sign Up logic:

await supabase.from('profiles').insert({ id: data.user.id, full_name: name, role: 'driver' })
await supabase.from('drivers').insert({ id: data.user.id, employee_id: empId, bus_number: busNumber, number_plate: numberPlate, email })
// On success → router.replace('/(driver)/')

Admin Auth (app/(auth)/admin-auth.tsx)

Sign In only — Email + Password
Note below form: "Admin accounts are provisioned by RMK IT Department"
On success → router.replace('/(admin)/')



STEP 4 — Student App

Home Screen (app/(student)/index.tsx)

Top half — Map (45% of screen height):





Use react-native-maps with MapView



Tile provider: OpenStreetMap urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"



On mount, fetch the student's assigned route from Supabase:

// Get student data
const { data: student } = await supabase
  .from('students').select('*').eq('id', user.id).single()

// Get active trip for student's bus
const { data: trip } = await supabase
  .from('trips').select('*')
  .eq('bus_number', student.bus_number)
  .eq('status', 'active').single()

// Get route stops
const { data: stops } = await supabase
  .from('stops').select('*')
  .eq('route_id', trip.route_id)
  .order('sequence')



Draw a dashed Polyline connecting all stop coordinates on the map (use hardcoded lat/lng for stops in dev)



Animated bus marker (🚌) at current position — animates smoothly between position updates



Student's own location as a blue dot (#3B82F6) using expo-location



Stop markers as small circles along the route line



Top-left map badge: "ROUTE 1 · LIVE" with a green pulsing dot (#22C55E) — only show when trip is active



Subscribe to bus position updates via Supabase Realtime on buses table

Bottom half — Info Card + Button:





White card sliding up from bottom (rounded top corners 24px), shadow



Bus Number (DM Mono Bold, 22px): e.g. Bus 5



Number Plate (DM Mono, 13px, #888888): e.g. TN09 AB 1234



Route name (DM Sans, 13px, #888888): Route 1 — North Campus



Status badge: ON TRIP green pill | NOT STARTED gray pill



Next stop row: 📍 icon + stop name



Thin divider line



Wait for Me Button (full width, below divider):





Default state: #1A1A1A background, white text, DM Sans Bold — "🙋 Wait for Me"



When tapped:





Insert into wait_alerts: { trip_id, student_id, student_name, bus_stop, status: 'pending' }



Button changes to #F5C518 background, black text: "⏳ Waiting... 01:58" with live countdown



Countdown timer ticks down every second for 2 minutes



If driver accepts → show green banner: "✅ Driver is waiting for you!" — button resets



If driver denies → show red banner: "❌ Driver cannot wait" — button resets



If 2 minutes expire with NO driver response → update alert status to expired in Supabase → show amber banner: "⚠️ Driver did not respond. Try again?" → button resets immediately, student can tap again



Student can tap yellow button during countdown to cancel (deletes the alert row)



Subscribe to wait_alerts table via Supabase Realtime filtered by student_id to catch driver response

Bottom Tab Navigator:





🗺️ Home | 📅 Schedule | 👤 Profile



Active tab: #F5C518 icon + label



Inactive: #888888



White tab bar, top border #EEEEEE

Schedule Screen (app/(student)/schedule.tsx)





Fetch stops for student's assigned route ordered by sequence



List of stop rows:





Stop sequence number (DM Mono, yellow circle badge)



Stop name (DM Sans Bold, 14px)



Estimated arrival time (DM Mono, 13px, #888888) — static for now



Current/next stop highlighted with yellow left border and yellow badge



Section header: Route name + bus number



Empty state if no active trip

Profile Screen (app/(student)/profile.tsx)





Avatar circle (initials from full_name, yellow bg)



Full name (DM Sans Bold, 20px)



Roll number, email, bus number, bus stop — each in a white card row with label + value



Bus Number and Number Plate in DM Mono



"Sign Out" button — outlined, red text, calls supabase.auth.signOut() → router.replace('/(auth)/welcome')



STEP 5 — Driver App

Trip Control Screen (app/(driver)/index.tsx)

Top section — Driver Info Card:





White card: Driver name (DM Sans Bold), Employee ID (DM Mono, #888888), Bus Number (DM Mono Bold, large), Number Plate (DM Mono, #888888)

Trip Status Card:





When IDLE:





Status pill: "● IDLE" gray



Full-width black CTA: "▶ Start Trip"



On tap → insert into trips table:

await supabase.from('trips').insert({
  bus_number: driver.bus_number,
  number_plate: driver.number_plate,
  route_id: assignedRouteId,
  driver_id: user.id,
  status: 'active'
})
// Update bus status
await supabase.from('buses')
  .update({ status: 'on_trip' })
  .eq('bus_number', driver.bus_number)



When ACTIVE:





Status pill: "● TRIP ACTIVE" green, pulsing



Trip start time shown (DM Mono)



Full-width red CTA: "■ End Trip"



On tap → show confirmation bottom sheet: "End trip and save log?" with Confirm (black) / Cancel (outlined) buttons



On confirm:

await supabase.from('trips').update({ status: 'completed', end_time: new Date().toISOString() }).eq('id', tripId)
await supabase.from('buses').update({ status: 'idle' }).eq('bus_number', driver.bus_number)

Student Alert Panel:





Section label: "Student Alerts" (DM Sans Bold, 13px uppercase, #888888)



Subscribe to wait_alerts table via Supabase Realtime where trip_id = currentTripId and status = 'pending'



Each alert card (white, rounded, shadow):





Blue dot indicator + student name (DM Sans Bold) + bus stop (DM Sans, #888888)



Time since ping (DM Mono, 12px, #888888) e.g. "Just now", "1 min ago"



Two buttons side by side:





✅ Accept — green background, white text, rounded



❌ Deny — red outlined, red text, rounded



On Accept: await supabase.from('wait_alerts').update({ status: 'accepted' }).eq('id', alertId)



On Deny: await supabase.from('wait_alerts').update({ status: 'denied' }).eq('id', alertId)



Card animates out after response



Accepted alerts section below (collapsed, green tag)



Empty state: "No student alerts right now" with a subtle icon

Route Screen (app/(driver)/route.tsx)





Fetch stops for driver's assigned route



Same list style as student schedule



Driver's current stop highlighted

Profile Screen (app/(driver)/profile.tsx)





Driver name, employee ID (DM Mono), bus number (DM Mono Bold), number plate (DM Mono)



Sign Out button



STEP 6 — Admin App

Fleet Screen (app/(admin)/index.tsx)





Fetch all buses from Supabase with their route name (join routes)



Bus list cards (white, rounded, shadow):





Bus Number (DM Mono Bold, 18px, #111111) e.g. Bus 5



Number Plate (DM Mono, 13px, #888888) e.g. TN09 AB 1234



Route name (DM Sans, 13px)



Status badge: ON TRIP (green pill) | IDLE (gray pill)



FAB bottom-right: + yellow circle button → opens bottom sheet modal:





Form fields: Bus Number, Number Plate, Assign Route (picker from routes table)



Save button → supabase.from('buses').insert({...})



Cancel button



Swipe left on bus card to reveal red Delete button → supabase.from('buses').delete().eq('id', id)

Routes Screen (app/(admin)/routes.tsx)





Fetch all routes with their stops (join)



Route cards (white, rounded):





Route name (DM Sans Bold)



Assigned bus number (DM Mono, #888888)



Stop count badge (yellow pill)



Expand/collapse chevron to show ordered stop list below



FAB: + → Add Route modal:





Route name input



Dynamic stop list: add/remove stop rows, each with a name input



Save → insert into routes then stops (one row per stop with sequence)



Delete route (trash icon on card) → cascades to stops via FK

Logs Screen (app/(admin)/logs.tsx)





Fetch all trips ordered by created_at desc, join driver name from profiles



Filter bar at top: date picker to filter by day



Trip log rows:





Trip ID (DM Mono, 11px, #888888)



Route name | Driver name



Date + Start time → End time (DM Mono)



Status badge: COMPLETED green | ACTIVE yellow



Tap row → modal with full trip detail: all fields including duration calculated from start/end



Empty state if no logs



STEP 7 — Navigation & Auth Guard

In app/_layout.tsx:

// On mount, check Supabase session
const { data: { session } } = await supabase.auth.getSession()

if (!session) {
  router.replace('/(auth)/welcome')
  return
}

// Get role from profiles table
const { data: profile } = await supabase
  .from('profiles').select('role').eq('id', session.user.id).single()

if (profile.role === 'student') router.replace('/(student)/')
if (profile.role === 'driver')  router.replace('/(driver)/')
if (profile.role === 'admin')   router.replace('/(admin)/')



Build Order (follow this exactly)





Project setup + lib/supabase.ts + lib/types.ts + constants/theme.ts



Welcome screen



All 3 auth screens



Student Home screen (map + wait for me)



Student Schedule + Profile



Driver Trip Control screen



Driver Route + Profile



Admin Fleet screen



Admin Routes screen



Admin Logs screen



Auth guard in _layout.tsx



Reminders





Every screen imports colors from constants/theme.ts — no hardcoded hex strings in components



Every Supabase call has a loading state and error handler



DM Mono for all IDs, numbers, times, plates



DM Sans for all labels, headings, body text



Map uses OpenStreetMap tiles — no Google Maps API key needed



Bus Number (e.g. "Bus 5") and Number Plate (e.g. "TN09 AB 1234") are ALWAYS separate fields — never combined

