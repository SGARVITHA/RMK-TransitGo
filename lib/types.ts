export interface Profile {
  id: string
  full_name: string
  role: 'student' | 'driver' | 'admin'
  created_at: string
}

export interface Student {
  id: string
  roll_number: string
  bus_number: string
  bus_stop: string
  email: string
}

export interface Driver {
  id: string
  employee_id: string
  bus_number: string
  number_plate: string
  email: string
}

export interface Bus {
  id: string
  bus_number: string
  number_plate: string
  route_id: string
  status: 'idle' | 'on_trip'
}

export interface Route {
  id: string
  name: string
  created_at: string
}

export interface Stop {
  id: string
  route_id: string
  name: string
  sequence: number
}

export interface Trip {
  id: string
  bus_number: string
  number_plate: string
  route_id: string
  driver_id: string
  start_time: string
  end_time: string | null
  status: 'active' | 'completed'
  created_at: string
}

export interface WaitAlert {
  id: string
  trip_id: string
  student_id: string
  student_name: string
  bus_stop: string
  status: 'pending' | 'accepted' | 'denied' | 'expired'
  created_at: string
}
