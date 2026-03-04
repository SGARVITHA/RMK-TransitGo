import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import type { Region } from 'react-native-maps'
import * as Location from 'expo-location'
import { Colors } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { Student, Trip, Stop, Bus, Route as RouteType, WaitAlert } from '../../lib/types'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const UrlTile =
  Platform.OS === 'web'
    ? (() => null)
    : (require('react-native-maps') as typeof import('react-native-maps')).UrlTile

interface BusWithPosition extends Bus {
  latitude?: number
  longitude?: number
}

const DEV_STOPS_COORDS: { [name: string]: { latitude: number; longitude: number } } = {
  'RMK College Gate': { latitude: 13.2105, longitude: 80.0263 },
  'Thiruvallur Junction': { latitude: 13.1435, longitude: 79.913 },
  'Ambattur OT': { latitude: 13.1143, longitude: 80.1523 },
  'Anna Nagar': { latitude: 13.086, longitude: 80.2206 },
  Koyambedu: { latitude: 13.072, longitude: 80.1945 },
}

type BannerType = 'success' | 'error' | 'warning'

interface BannerState {
  type: BannerType
  message: string
}

export default function StudentHomeScreen() {
  const [student, setStudent] = useState<Student | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [route, setRoute] = useState<RouteType | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [busPosition, setBusPosition] = useState<{ latitude: number; longitude: number } | null>(
    null,
  )
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isWaiting, setIsWaiting] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)
  const [banner, setBanner] = useState<BannerState | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) {
          throw userError
        }
        if (!user) {
          throw new Error('Not signed in')
        }

        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('id', user.id)
          .single<Student>()
        if (studentError) {
          throw studentError
        }
        setStudent(studentData)

        const { data: tripData } = await supabase
          .from('trips')
          .select('*')
          .eq('bus_number', studentData.bus_number)
          .eq('status', 'active')
          .maybeSingle<Trip>()
        if (tripData) {
          setTrip(tripData)

          if (tripData.route_id) {
            const { data: routeData } = await supabase
              .from('routes')
              .select('*')
              .eq('id', tripData.route_id)
              .single<RouteType>()
            setRoute(routeData)
          }

          const { data: stopsData } = await supabase
            .from('stops')
            .select('*')
            .eq('route_id', tripData.route_id)
            .order('sequence', { ascending: true })
            .returns<Stop[]>()
          if (stopsData) {
            setStops(stopsData)
          }
        }

        if (Platform.OS !== 'web') {
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status === 'granted') {
            const current = await Location.getCurrentPositionAsync({})
            setUserLocation({
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            })
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load trip data. Please try again.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    if (!student) {
      return
    }

    const channel = supabase
      .channel('buses-position')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'buses',
          filter: `bus_number=eq.${student.bus_number}`,
        },
        payload => {
          const row = payload.new as BusWithPosition
          if (row.latitude && row.longitude) {
            setBusPosition({
              latitude: row.latitude,
              longitude: row.longitude,
            })
          }
        },
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [student])

  useEffect(() => {
    if (!student) {
      return
    }

    const channel = supabase
      .channel('wait-alerts-student')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wait_alerts',
          filter: `student_id=eq.${student.id}`,
        },
        payload => {
          const alert = payload.new as WaitAlert
          if (!activeAlertId || alert.id !== activeAlertId) {
            return
          }

          if (alert.status === 'accepted') {
            setBanner({ type: 'success', message: '✅ Driver is waiting for you!' })
            setIsWaiting(false)
            setActiveAlertId(null)
            setRemainingSeconds(0)
          } else if (alert.status === 'denied') {
            setBanner({ type: 'error', message: '❌ Driver cannot wait' })
            setIsWaiting(false)
            setActiveAlertId(null)
            setRemainingSeconds(0)
          }
        },
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [student, activeAlertId])

  useEffect(() => {
    if (!isWaiting || !activeAlertId) {
      return
    }

    setRemainingSeconds(120)
    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          void handleExpire(activeAlertId)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [isWaiting, activeAlertId])

  const handleExpire = async (alertId: string) => {
    try {
      await supabase
        .from('wait_alerts')
        .update({ status: 'expired' })
        .eq('id', alertId)

      setBanner({
        type: 'warning',
        message: '⚠️ Driver did not respond. Try again?',
      })
    } finally {
      setIsWaiting(false)
      setActiveAlertId(null)
      setRemainingSeconds(0)
    }
  }

  const handleWaitForMePress = async () => {
    if (!student || !trip) {
      return
    }

    if (isWaiting && activeAlertId) {
      await supabase.from('wait_alerts').delete().eq('id', activeAlertId)
      setIsWaiting(false)
      setActiveAlertId(null)
      setRemainingSeconds(0)
      return
    }

    try {
      const { data, error: insertError } = await supabase
        .from('wait_alerts')
        .insert({
          trip_id: trip.id,
          student_id: student.id,
          student_name: (student as unknown as { full_name?: string }).full_name ?? '',
          bus_stop: student.bus_stop,
          status: 'pending',
        })
        .select()
        .single<WaitAlert>()

      if (insertError) {
        throw insertError
      }

      setBanner(null)
      setIsWaiting(true)
      setActiveAlertId(data.id)
      setRemainingSeconds(120)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not send alert. Please try again.'
      setBanner({ type: 'error', message })
    }
  }

  const polylineCoordinates = useMemo(
    () =>
      stops
        .map(stop => DEV_STOPS_COORDS[stop.name])
        .filter(Boolean) as { latitude: number; longitude: number }[],
    [stops],
  )

  const initialRegion: Region | undefined = useMemo(() => {
    const first = polylineCoordinates[0]
    if (first) {
      return {
        ...first,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      }
    }
    if (userLocation) {
      return {
        ...userLocation,
        latitudeDelta: 0.2,
        longitudeDelta: 0.2,
      }
    }
    return undefined
  }, [polylineCoordinates, userLocation])

  const nextStopName = stops[0]?.name ?? 'TBD'

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const renderBanner = () => {
    if (!banner) {
      return null
    }

    const backgroundColor =
      banner.type === 'success'
        ? Colors.green
        : banner.type === 'error'
        ? Colors.red
        : Colors.amber

    return (
      <View style={[styles.banner, { backgroundColor }]}>
        <Text style={styles.bannerText}>{banner.message}</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.dark} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {initialRegion && (
        <View style={styles.mapContainer}>
          <MapView style={StyleSheet.absoluteFill} initialRegion={initialRegion}>
            <UrlTile
              urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />

            {polylineCoordinates.length > 0 && (
              <Polyline
                coordinates={polylineCoordinates}
                strokeColor={Colors.dark}
                strokeWidth={3}
                lineDashPattern={[8, 6]}
              />
            )}

            {stops.map(stop => {
              const coords = DEV_STOPS_COORDS[stop.name]
              if (!coords) {
                return null
              }
              return (
                <Marker
                  key={stop.id}
                  coordinate={coords}
                  pinColor={Colors.primary}
                  title={stop.name}
                />
              )
            })}

            {busPosition && (
              <Marker coordinate={busPosition} title="Bus">
                <View style={styles.busMarker}>
                  <Text style={styles.busMarkerText}>🚌</Text>
                </View>
              </Marker>
            )}

            {userLocation && (
              <Marker coordinate={userLocation} title="You">
                <View style={styles.userDot} />
              </Marker>
            )}
          </MapView>

          {trip && (
            <View style={styles.routeBadge}>
              <View style={styles.liveDotOuter}>
                <View style={styles.liveDotInner} />
              </View>
              <Text style={styles.routeBadgeText}>
                {route ? route.name : 'ROUTE'} · LIVE
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.bottomSheet}>
        {renderBanner()}
        <ScrollView
          contentContainerStyle={styles.bottomContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.busRow}>
            <View>
              <Text style={styles.busLabel}>Bus Number</Text>
              <Text style={styles.busNumber}>{trip?.bus_number ?? student?.bus_number}</Text>
            </View>
            <View>
              <Text style={styles.busLabel}>Number Plate</Text>
              <Text style={styles.busPlate}>TN09 AB 1234</Text>
            </View>
          </View>

          <View style={styles.routeRow}>
            <Text style={styles.routeName}>
              {route ? `${route.name}` : 'Route info soon'}
            </Text>
            <View
              style={[
                styles.statusBadge,
                trip?.status === 'active' ? styles.statusOnTrip : styles.statusIdle,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  trip?.status === 'active' ? styles.statusTextOnTrip : styles.statusTextIdle,
                ]}
              >
                {trip?.status === 'active' ? 'ON TRIP' : 'NOT STARTED'}
              </Text>
            </View>
          </View>

          <View style={styles.nextStopRow}>
            <Text style={styles.nextStopIcon}>📍</Text>
            <View>
              <Text style={styles.nextStopLabel}>Next stop</Text>
              <Text style={styles.nextStopName}>{nextStopName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={[
              styles.waitButton,
              isWaiting ? styles.waitButtonWaiting : styles.waitButtonDefault,
            ]}
            activeOpacity={0.9}
            onPress={handleWaitForMePress}
          >
            <Text
              style={[
                styles.waitButtonText,
                isWaiting ? styles.waitButtonTextWaiting : styles.waitButtonTextDefault,
              ]}
            >
              {isWaiting
                ? `⏳ Waiting... ${formatCountdown(remainingSeconds)}`
                : '🙋 Wait for Me'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.45,
  },
  bottomSheet: {
    flex: 1,
    marginTop: -24,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  bottomContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  errorText: {
    fontSize: 14,
    color: Colors.red,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  busRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  busLabel: {
    fontSize: 12,
    color: Colors.textSecond,
    fontFamily: 'DMSans_400Regular',
  },
  busNumber: {
    marginTop: 4,
    fontSize: 22,
    color: Colors.textPrimary,
    fontFamily: 'DMMono_700Bold',
  },
  busPlate: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  routeName: {
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMSans_500Medium',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusOnTrip: {
    backgroundColor: Colors.green,
  },
  statusIdle: {
    backgroundColor: '#E5E7EB',
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
  },
  statusTextOnTrip: {
    color: '#022C22',
  },
  statusTextIdle: {
    color: Colors.textSecond,
  },
  nextStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextStopIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  nextStopLabel: {
    fontSize: 12,
    color: Colors.textSecond,
    fontFamily: 'DMSans_400Regular',
  },
  nextStopName: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  waitButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitButtonDefault: {
    backgroundColor: Colors.dark,
  },
  waitButtonWaiting: {
    backgroundColor: Colors.primary,
  },
  waitButtonText: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  waitButtonTextDefault: {
    color: Colors.surface,
  },
  waitButtonTextWaiting: {
    color: Colors.dark,
  },
  busMarker: {
    padding: 4,
    backgroundColor: Colors.surface,
    borderRadius: 999,
  },
  busMarkerText: {
    fontSize: 20,
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.blue,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  routeBadge: {
    position: 'absolute',
    top: 40,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeBadgeText: {
    marginLeft: 8,
    fontSize: 12,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  liveDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
  },
  banner: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'DMSans_500Medium',
  },
})

