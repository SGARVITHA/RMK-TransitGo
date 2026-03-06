import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as Location from 'expo-location'
import {
  useFonts, DMSans_400Regular,
  DMSans_600SemiBold, DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans'
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono'
import { Colors } from '../../constants/theme'

export default function DriverHome() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular, DMSans_600SemiBold,
    DMSans_700Bold, DMSans_800ExtraBold,
    DMMono_400Regular,
  })

  const [driverData, setDriverData] = useState<any>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [tripData, setTripData] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tripLoading, setTripLoading] = useState(false)
  const [alertLoading, setAlertLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const locationIntervalRef = useRef<any>(null)
  const tripStartTime = useRef<Date | null>(null)
  const [elapsed, setElapsed] = useState('00:00')
  const elapsedIntervalRef = useRef<any>(null)

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('*')
        .eq('id', user.id).single()
      setProfileData(profile)

      const { data: driver } = await supabase
        .from('drivers').select('*')
        .eq('id', user.id).single()
      setDriverData(driver)

      if (driver) {
        const { data: trips } = await supabase
          .from('trips').select('*')
          .eq('bus_number', driver.bus_number)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        const activeTrip = trips?.[0] || null
        setTripData(activeTrip)

        if (activeTrip) {
          tripStartTime.current = new Date(activeTrip.start_time || activeTrip.created_at)
          startElapsedTimer()
          startLocationBroadcast(driver, activeTrip.id)
          loadAlerts(activeTrip.id)
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const loadAlerts = async (tripId: string) => {
    const { data } = await supabase
      .from('wait_alerts').select('*')
      .eq('trip_id', tripId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setAlerts(data || [])
  }

  useEffect(() => {
    if (!tripData?.id) return
    const channel = supabase
      .channel('driver-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'wait_alerts',
        filter: `trip_id=eq.${tripData.id}`,
      }, (payload) => {
        setAlerts(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'wait_alerts',
        filter: `trip_id=eq.${tripData.id}`,
      }, (payload) => {
        setAlerts(prev => prev.filter(
          a => a.id !== payload.new.id
        ))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tripData?.id])

  const startElapsedTimer = () => {
    elapsedIntervalRef.current = setInterval(() => {
      if (!tripStartTime.current) return
      const diff = Date.now() - tripStartTime.current.getTime()
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsed(
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      )
    }, 1000)
  }

  const startLocationBroadcast = async (driver: any, tripId: string) => {
    if (Platform.OS === 'web') return

    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      setError('Location permission denied.')
      return
    }

    const broadcastLocation = async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        await supabase.from('bus_locations').upsert({
          bus_number: driver.bus_number,
          driver_id: driver.id,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'bus_number' })
      } catch (e) {
        console.log('Location broadcast error:', e)
      }
    }

    broadcastLocation()
    locationIntervalRef.current = setInterval(broadcastLocation, 10000)
  }

  const stopLocationBroadcast = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current)
      locationIntervalRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopLocationBroadcast()
      clearInterval(elapsedIntervalRef.current)
    }
  }, [])

  const handleStartTrip = async () => {
    setTripLoading(true)
    setError(null)
    try {
      await supabase.from('trips')
        .update({
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('bus_number', driverData.bus_number)
        .eq('status', 'active')

      await supabase.from('buses')
        .update({ status: 'idle' })
        .eq('bus_number', driverData.bus_number)

      const { data: trip, error: tripError } = await supabase
        .from('trips').insert({
          bus_number: driverData.bus_number,
          number_plate: driverData.number_plate,
          driver_id: driverData.id,
          status: 'active',
          start_time: new Date().toISOString(),
        }).select().single()
      if (tripError) throw tripError

      await supabase.from('buses')
        .update({ status: 'on_trip' })
        .eq('bus_number', driverData.bus_number)

      setTripData(trip)
      tripStartTime.current = new Date()
      startElapsedTimer()
      startLocationBroadcast(driverData, trip.id)
      loadAlerts(trip.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTripLoading(false)
    }
  }

  const handleEndTrip = () => {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: async () => {
            setTripLoading(true)
            try {
              await supabase.from('trips')
                .update({
                  status: 'completed',
                  end_time: new Date().toISOString(),
                })
                .eq('id', tripData.id)

              await supabase.from('buses')
                .update({ status: 'idle' })
                .eq('bus_number', driverData.bus_number)

              stopLocationBroadcast()
              clearInterval(elapsedIntervalRef.current)
              setTripData(null)
              setAlerts([])
              setElapsed('00:00')
              tripStartTime.current = null
            } catch (err: any) {
              setError(err.message)
            } finally {
              setTripLoading(false)
            }
          },
        },
      ]
    )
  }

  const handleAlertResponse = async (alertId: string, response: 'accepted' | 'denied') => {
    setAlertLoading(alertId)
    try {
      await supabase.from('wait_alerts')
        .update({ status: response })
        .eq('id', alertId)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      setExpandedAlert(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAlertLoading(null)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'D'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const getFirstName = (name: string) => name?.trim().split(' ')[0] || 'Driver'

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  if (!fontsLoaded || loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.textPrimary} />
    </View>
  )

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greetingText}>Hello,</Text>
          <Text style={styles.nameText}>
            {getFirstName(profileData?.full_name || '')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(driver)/profile')}
          style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getInitials(profileData?.full_name || '')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.floatingCard}>
        <View style={styles.dragHandle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.driverCard}>
            <View style={styles.driverInfoRow}>
              <View>
                <Text style={styles.driverCardLabel}>Driver</Text>
                <Text style={styles.driverCardValue}>
                  {profileData?.full_name || '---'}
                </Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={styles.driverCardLabel}>Employee ID</Text>
                <Text style={styles.driverCardId}>
                  {driverData?.employee_id || '---'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.driverInfoRowBottom}>
              <View>
                <Text style={styles.driverCardLabel}>Bus No.</Text>
                <Text style={styles.busNoText}>
                  {driverData?.bus_number?.replace('Bus ', '') || '---'}
                </Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={styles.driverCardLabel}>Number Plate</Text>
                <Text style={styles.plateText}>
                  {driverData?.number_plate || '---'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tripCard}>
            <View style={styles.tripStatusRow}>
              <Text style={styles.tripStatusLabel}>Trip Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: tripData ? Colors.successBg : Colors.modalBorder }]}>
                <View style={[styles.statusDot, { backgroundColor: tripData ? Colors.green : Colors.textTertiary }]} />
                <Text style={[styles.statusText, { color: tripData ? Colors.greenDark : Colors.textSecond }]}>
                  {tripData ? 'TRIP ACTIVE' : 'IDLE'}
                </Text>
              </View>
            </View>

            {tripData && (
              <View style={styles.durationBox}>
                <View style={styles.durationLeft}>
                  <Ionicons name="time-outline" size={18} color={Colors.textSecond} />
                  <Text style={styles.durationLabel}>Trip Duration</Text>
                </View>
                <Text style={styles.durationValue}>{elapsed}</Text>
              </View>
            )}

            {!tripData ? (
              <TouchableOpacity
                onPress={handleStartTrip}
                disabled={tripLoading}
                activeOpacity={0.85}
                style={[styles.tripBtn, { opacity: tripLoading ? 0.7 : 1 }]}>
                {tripLoading
                  ? <ActivityIndicator color={Colors.surface} />
                  : <>
                    <Ionicons name="play-circle-outline" size={20} color={Colors.yellowBar} />
                    <Text style={styles.startTripText}>Start Trip</Text>
                  </>
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleEndTrip}
                disabled={tripLoading}
                activeOpacity={0.85}
                style={[styles.endTripBtn, { opacity: tripLoading ? 0.7 : 1 }]}>
                {tripLoading
                  ? <ActivityIndicator color={Colors.red} />
                  : <>
                    <Ionicons name="stop-circle-outline" size={20} color={Colors.red} />
                    <Text style={styles.endTripText}>End Trip</Text>
                  </>
                }
              </TouchableOpacity>
            )}

            {tripData && Platform.OS !== 'web' && (
              <View style={styles.gpsNote}>
                <View style={styles.gpsDot} />
                <Text style={styles.gpsText}>
                  Broadcasting location every 10 seconds
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.alertsHeader}>
            Student Alerts · {alerts.length} pending
          </Text>

          {alerts.length === 0 ? (
            <View style={styles.noAlertsBox}>
              <Ionicons name="notifications-off-outline" size={32} color={Colors.checkboxBorder} />
              <Text style={styles.noAlertsTitle}>No student alerts right now</Text>
              <Text style={styles.noAlertsDesc}>
                {tripData
                  ? 'Alerts will appear here when students request a wait'
                  : 'Start a trip to receive student alerts'
                }
              </Text>
            </View>
          ) : (
            alerts.map(alert => {
              const isExpanded = expandedAlert === alert.id
              const isLoading = alertLoading === alert.id
              return (
                <TouchableOpacity
                  key={alert.id}
                  activeOpacity={0.9}
                  onPress={() => setExpandedAlert(isExpanded ? null : alert.id)}
                  style={[styles.alertItem, { borderColor: isExpanded ? Colors.yellowBar : Colors.border }]}
                >
                  <View style={styles.alertItemTop}>
                    <View style={styles.alertItemLeft}>
                      <View style={styles.alertBlueDot} />
                      <View style={styles.flex1}>
                        <Text style={styles.alertStudentName}>
                          {alert.student_name || 'Student'}
                        </Text>
                        <View style={styles.alertDetailRow}>
                          <Ionicons name="location-outline" size={12} color={Colors.textSecond} />
                          <Text style={styles.alertStopText}>
                            {alert.bus_stop || 'Unknown stop'}
                          </Text>
                          <Text style={styles.alertDetailDot}>·</Text>
                          <Text style={styles.alertDetailDot}>
                            {timeAgo(alert.created_at)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16} color={Colors.textTertiary}
                    />
                  </View>

                  {isExpanded && (
                    <View style={styles.alertActionsRow}>
                      <TouchableOpacity
                        onPress={() => handleAlertResponse(alert.id, 'accepted')}
                        disabled={!!isLoading}
                        style={styles.acceptBtn}>
                        {isLoading
                          ? <ActivityIndicator color={Colors.green} size="small" />
                          : <>
                            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.green} />
                            <Text style={styles.acceptText}>Accept</Text>
                          </>
                        }
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleAlertResponse(alert.id, 'denied')}
                        disabled={!!isLoading}
                        style={styles.denyBtn}>
                        {isLoading
                          ? <ActivityIndicator color={Colors.red} size="small" />
                          : <>
                            <Ionicons name="close-circle-outline" size={18} color={Colors.red} />
                            <Text style={styles.denyText}>Deny</Text>
                          </>
                        }
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.yellowBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.yellowBar,
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.black60,
  },
  nameText: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 22,
    color: Colors.textPrimary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.yellowBar,
  },
  floatingCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
  },
  driverCard: {
    backgroundColor: Colors.inputBg,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  driverCardLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  driverCardValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  driverCardId: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  driverInfoRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  busNoText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 22,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  plateText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  tripCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  tripStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tripStatusLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  statusBadge: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
  },
  durationBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textSecond,
  },
  durationValue: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  tripBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startTripText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.surface,
  },
  endTripBtn: {
    backgroundColor: Colors.errorBg,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.redBorder,
  },
  endTripText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.red,
  },
  gpsNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },
  gpsText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textSecond,
  },
  alertsHeader: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  noAlertsBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  noAlertsTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    color: Colors.chevron,
    marginTop: 10,
  },
  noAlertsDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.checkboxBorder,
    marginTop: 4,
    textAlign: 'center',
  },
  alertItem: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  alertItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alertBlueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.blue,
  },
  flex1: {
    flex: 1,
  },
  alertStudentName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  alertDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  alertStopText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.textSecond,
  },
  alertDetailDot: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.chevron,
  },
  alertActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: Colors.successBg,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
  },
  acceptText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: Colors.greenDark,
  },
  denyBtn: {
    flex: 1,
    backgroundColor: Colors.errorBg,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.redBorder,
  },
  denyText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: Colors.redDark,
  },
  errorBanner: {
    backgroundColor: Colors.errorBg,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.redBorder,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.redDark,
    flex: 1,
  }
})
