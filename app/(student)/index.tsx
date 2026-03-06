import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Dimensions, ActivityIndicator,
  Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  useFonts, DMSans_400Regular,
  DMSans_600SemiBold, DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans'
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono'
import { Colors } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

let MapView: any, Marker: any, Polyline: any
if (Platform.OS === 'web') {
  MapView = ({ style, children }: any) => (
    <View style={[style, styles.mapWebPlaceholder]}>
      <Ionicons name="map" size={32} color={Colors.textTertiary} />
      <Text style={styles.mapWebText}>
        Map preview available on mobile only
      </Text>
      {children}
    </View>
  )
  Marker = () => null
  Polyline = () => null
} else {
  const Maps = require('react-native-maps')
  MapView = Maps.default
  Marker = Maps.Marker
  Polyline = Maps.Polyline
}

export default function StudentHome() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular, DMSans_600SemiBold,
    DMSans_700Bold, DMSans_800ExtraBold,
    DMMono_400Regular,
  })
  const [studentData, setStudentData] = useState<any>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [tripData, setTripData] = useState<any>(null)
  const [stops, setStops] = useState<any[]>([])
  const [busData, setBusData] = useState<any>(null)
  const [busLocation, setBusLocation] = useState<any>(null)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [alertStatus, setAlertStatus] = useState<
    'idle' | 'pending' | 'accepted' | 'denied' | 'expired'
  >('idle')
  const [secondsLeft, setSecondsLeft] = useState(120)
  const [loading, setLoading] = useState(true)
  const [waitLoading, setWaitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<any>(null)

  const mapHeightAnim = useRef(
    new Animated.Value(height * 0.5)
  ).current

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('*')
        .eq('id', user.id).single()
      setProfileData(profile)

      const { data: student } = await supabase
        .from('students').select('*')
        .eq('id', user.id).single()
      setStudentData(student)

      if (student?.bus_number) {
        const { data: bus } = await supabase
          .from('buses').select('*')
          .eq('bus_number', student.bus_number).single()
        setBusData(bus)

        if (bus?.route_id) {
          const { data: routeStops } = await supabase
            .from('stops').select('*')
            .eq('route_id', bus.route_id)
            .order('sequence')
          setStops(routeStops || [])
        }

        const { data: trips } = await supabase
          .from('trips').select('*')
          .eq('bus_number', student.bus_number)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        setTripData(trips?.[0] || null)

        const { data: loc } = await supabase
          .from('bus_locations').select('*')
          .eq('bus_number', student.bus_number)
          .order('updated_at', { ascending: false })
          .limit(1)
        setBusLocation(loc?.[0] || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Realtime bus location updates
  useEffect(() => {
    if (!studentData?.bus_number) return
    const channel = supabase
      .channel('bus-location-updates')
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'bus_locations',
        filter: `bus_number=eq.${studentData.bus_number}`,
      }, (payload) => {
        setBusLocation(payload.new)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [studentData?.bus_number])

  // Realtime wait alert response
  useEffect(() => {
    if (!studentData) return
    const channel = supabase
      .channel('wait-alert-response')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'wait_alerts',
      }, (payload) => {
        const s = payload.new.status
        if (s === 'accepted' || s === 'denied') {
          clearInterval(timerRef.current)
          setSecondsLeft(120)
          setAlertStatus(s)
          setTimeout(() => setAlertStatus('idle'), 4000)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [studentData])

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const toggleMap = () => {
    const toValue = mapExpanded
      ? height * 0.5
      : height * 0.85
    Animated.spring(mapHeightAnim, {
      toValue, tension: 50, friction: 8,
      useNativeDriver: false,
    }).start()
    setMapExpanded(!mapExpanded)
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleWaitForMe = async () => {
    if (alertStatus === 'pending') {
      clearInterval(timerRef.current)
      setAlertStatus('idle')
      setSecondsLeft(120)
      return
    }
    setWaitLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!tripData) throw new Error(
        'No active trip for your bus right now.'
      )
      await supabase.from('wait_alerts').insert({
        trip_id: tripData.id,
        student_id: user!.id,
        student_name: profileData?.full_name,
        bus_stop: studentData?.bus_stop,
        status: 'pending',
      })
      setAlertStatus('pending')
      setSecondsLeft(120)
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(timerRef.current)
            setAlertStatus('expired')
            setSecondsLeft(120)
            setTimeout(() => setAlertStatus('idle'), 4000)
            return 120
          }
          return s - 1
        })
      }, 1000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWaitLoading(false)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0][0].toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const getFirstName = (name: string) =>
    name?.trim().split(' ')[0] || 'there'

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
      {!mapExpanded && (
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greetingText}>Hello,</Text>
            <Text style={styles.nameText}>
              {getFirstName(profileData?.full_name || '')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(student)/profile')}
            style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(profileData?.full_name || '')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={{ height: mapHeightAnim }}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 13.1986,
            longitude: 79.9650,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          scrollEnabled={mapExpanded}
          zoomEnabled={mapExpanded}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {stops.length > 1 && (
            <Polyline
              coordinates={stops.map(s => ({
                latitude: s.latitude || 13.1986,
                longitude: s.longitude || 79.9650,
              }))}
              strokeColor={Colors.textPrimary}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          )}

          {stops.map((stop, i) => (
            <Marker
              key={stop.id}
              coordinate={{
                latitude: stop.latitude || 13.1986 + i * 0.01,
                longitude: stop.longitude || 79.9650 + i * 0.01,
              }}
              title={stop.name}
            >
              <View style={styles.stopMarker} />
            </Marker>
          ))}

          {busLocation && (
            <Marker
              coordinate={{
                latitude: busLocation.latitude,
                longitude: busLocation.longitude,
              }}
              title={`Bus ${studentData?.bus_number}`}
            >
              <View style={styles.busMarker}>
                <Ionicons name="bus" size={14} color={Colors.yellowBar} />
                <Text style={styles.busMarkerText}>
                  {studentData?.bus_number}
                </Text>
              </View>
            </Marker>
          )}
        </MapView>

        <View style={styles.mapTopOverlay}>
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, { backgroundColor: tripData ? Colors.green : Colors.textTertiary }]} />
            <Text style={styles.liveText}>
              {tripData ? 'LIVE' : 'NO ACTIVE TRIP'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={toggleMap}
            style={styles.expandButton}>
            <Ionicons
              name={mapExpanded ? "contract-outline" : "expand-outline"}
              size={16} color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {mapExpanded && (
          <TouchableOpacity
            onPress={toggleMap}
            style={styles.collapseHint}>
            <Ionicons name="chevron-down" size={14} color={Colors.surface} />
            <Text style={styles.collapseText}>Collapse map</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {!mapExpanded && (
        <View style={styles.floatingCard}>
          <View style={styles.dragHandle} />

          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoLabel}>Bus No.</Text>
              <Text style={styles.busNoText}>
                {studentData?.bus_number?.replace('Bus ', '') || '---'}
              </Text>
            </View>
            <View style={styles.alignEnd}>
              <Text style={styles.infoLabel}>Number Plate</Text>
              <Text style={styles.plateText}>
                {busData?.number_plate || '---'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRowCenter}>
            <View>
              <Text style={styles.infoLabel}>Route</Text>
              <Text style={styles.routeText}>
                {busData?.route_id ? 'North Campus Route' : '---'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: tripData ? Colors.successBg : Colors.modalBorder }]}>
              <View style={[styles.statusDot, { backgroundColor: tripData ? Colors.green : Colors.textTertiary }]} />
              <Text style={[styles.statusText, { color: tripData ? Colors.greenDark : Colors.textSecond }]}>
                {tripData ? 'ON TRIP' : 'NOT STARTED'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRowCenterSmallBottom}>
            <View style={styles.flex1}>
              <Text style={styles.infoLabel}>Next Stop</Text>
              <View style={styles.nextStopRow}>
                <Ionicons name="location" size={16} color={Colors.yellowBar} />
                <Text style={styles.nextStopText}>
                  {stops[0]?.name || studentData?.bus_stop || '---'}
                </Text>
              </View>
            </View>
            <View style={styles.alignEnd}>
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={styles.etaText}>~8 min</Text>
            </View>
          </View>

          {alertStatus === 'accepted' && (
            <View style={[styles.alertBanner, styles.alertAccepted]}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
              <Text style={[styles.alertText, { color: Colors.greenDark }]}>Driver is waiting for you!</Text>
            </View>
          )}

          {alertStatus === 'denied' && (
            <View style={[styles.alertBanner, styles.alertDenied]}>
              <Ionicons name="close-circle" size={20} color={Colors.red} />
              <Text style={[styles.alertText, { color: Colors.redDark }]}>Driver cannot wait at this time.</Text>
            </View>
          )}

          {alertStatus === 'expired' && (
            <View style={[styles.alertBanner, styles.alertExpired]}>
              <Ionicons name="time-outline" size={20} color={Colors.amberDark} />
              <View style={styles.flex1}>
                <Text style={[styles.alertText, { color: Colors.amberDarker }]}>Driver did not respond.</Text>
                <Text style={styles.alertSubText}>Tap below to try again.</Text>
              </View>
            </View>
          )}

          {error && (
            <View style={[styles.alertBanner, styles.alertDenied]}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.red} />
              <Text style={[styles.errorText, { color: Colors.redDark }]}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {!mapExpanded && (
        <View style={styles.fixedBottomBar}>
          <TouchableOpacity
            onPress={handleWaitForMe}
            disabled={waitLoading}
            activeOpacity={0.85}
            style={[
              styles.waitForMeBtn,
              { backgroundColor: alertStatus === 'pending' ? Colors.yellowBar : Colors.textPrimary },
              waitLoading && { opacity: 0.7 }
            ]}>
            {waitLoading ? (
              <ActivityIndicator color={alertStatus === 'pending' ? Colors.textPrimary : Colors.surface} />
            ) : (
              <>
                <Ionicons
                  name={alertStatus === 'pending' ? "time-outline" : "hand-left-outline"}
                  size={18}
                  color={alertStatus === 'pending' ? Colors.textPrimary : Colors.surface}
                />
                <Text style={[
                  styles.waitForMeBtnText,
                  { color: alertStatus === 'pending' ? Colors.textPrimary : Colors.surface }
                ]}>
                  {alertStatus === 'pending'
                    ? `Waiting... ${formatTime(secondsLeft)}`
                    : 'Wait for Me'
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  mapWebPlaceholder: {
    backgroundColor: Colors.mapWebBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWebText: {
    color: Colors.textTertiary,
    fontSize: 13,
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
  },
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
    paddingBottom: 16,
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
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.yellowBar,
  },
  map: {
    flex: 1,
  },
  stopMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.yellowBar,
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },
  busMarker: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  busMarkerText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: Colors.surface,
  },
  mapTopOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    backgroundColor: Colors.white95,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  expandButton: {
    backgroundColor: Colors.white95,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  collapseHint: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collapseText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: Colors.surface,
  },
  floatingCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 100,
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
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  busNoText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 26,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  plateText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.modalBorder,
    marginBottom: 20,
  },
  infoRowCenter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  routeText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
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
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
  },
  infoRowCenterSmallBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  flex1: {
    flex: 1,
  },
  nextStopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextStopText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  etaText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 20,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  alertBanner: {
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  alertAccepted: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.greenBorder,
  },
  alertDenied: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.redBorder,
  },
  alertExpired: {
    backgroundColor: Colors.amberBg,
    borderColor: Colors.amberBorder,
  },
  alertText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 14,
    flex: 1,
  },
  alertSubText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.amberText,
    marginTop: 2,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    flex: 1,
  },
  fixedBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  waitForMeBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  waitForMeBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
  },
})
