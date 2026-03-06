import { Ionicons } from '@expo/vector-icons'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  useFonts, DMSans_400Regular,
  DMSans_600SemiBold, DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans'
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono'
import { Colors } from '../../constants/theme'

export default function StudentSchedule() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular, DMSans_600SemiBold,
    DMSans_700Bold, DMSans_800ExtraBold,
    DMMono_400Regular,
  })
  const [stops, setStops] = useState<any[]>([])
  const [studentData, setStudentData] = useState<any>(null)
  const [busData, setBusData] = useState<any>(null)
  const [tripData, setTripData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentStopIndex, setCurrentStopIndex] = useState(0)

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

          const idx = routeStops?.findIndex(
            (s: any) => s.name === student.bus_stop
          ) ?? 0
          setCurrentStopIndex(idx >= 0 ? idx : 0)
        }

        const { data: trips } = await supabase
          .from('trips').select('*')
          .eq('bus_number', student.bus_number)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        setTripData(trips?.[0] || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const getETA = (stopIndex: number) => {
    const diff = stopIndex - currentStopIndex
    if (diff < 0) return null
    if (diff === 0) return 'Arriving'
    return `~${diff * 8} min`
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
          <Text style={styles.routeText}>
            {busData?.bus_number || 'Your Bus'} · Route Stops
          </Text>
          <Text style={styles.headerText}>
            Schedule
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.activityBadge}>
            <View style={[
              styles.activityDot,
              {
                backgroundColor: tripData ? Colors.green : Colors.textPrimary,
                opacity: tripData ? 1 : 0.4,
              }
            ]} />
            <Text style={styles.activityText}>
              {tripData ? 'Trip Active' : 'No Active Trip'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.floatingCard}>
        <View style={styles.dragHandle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionLabel}>
            All Stops · {stops.length} total
          </Text>

          {stops.map((stop, index) => {
            const isPassed = index < currentStopIndex
            const isCurrent = index === currentStopIndex
            const isStudentStop = stop.name === studentData?.bus_stop
            const eta = getETA(index)

            return (
              <View key={stop.id} style={styles.stopRow}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    {
                      width: isCurrent ? 16 : 12,
                      height: isCurrent ? 16 : 12,
                      borderRadius: isCurrent ? 8 : 6,
                      backgroundColor: isCurrent
                        ? Colors.yellowBar
                        : isPassed
                          ? Colors.checkboxBorder
                          : Colors.textPrimary,
                      borderWidth: isCurrent ? 3 : 2,
                      borderColor: isCurrent
                        ? Colors.textPrimary
                        : isPassed
                          ? Colors.border
                          : Colors.textPrimary,
                    }
                  ]} />
                  {index < stops.length - 1 && (
                    <View style={[
                      styles.timelineLine,
                      {
                        backgroundColor: isPassed
                          ? Colors.border
                          : Colors.midGray,
                      }
                    ]} />
                  )}
                </View>

                <View style={styles.stopInfoRight}>
                  <View style={styles.stopNameRow}>
                    <View style={styles.stopNameContainer}>
                      <Text style={[
                        styles.stopNameText,
                        {
                          fontFamily: isCurrent || isStudentStop
                            ? 'DMSans_700Bold'
                            : 'DMSans_400Regular',
                          color: isPassed ? Colors.lightGray : Colors.textPrimary,
                        }
                      ]}>
                        {stop.name}
                      </Text>
                      {isStudentStop && (
                        <View style={styles.yourStopBadge}>
                          <Text style={styles.yourStopText}>Your Stop</Text>
                        </View>
                      )}
                    </View>

                    {!isPassed && eta && (
                      <Text style={[
                        styles.etaText,
                        {
                          color: isCurrent ? Colors.yellowBar : Colors.textSecond,
                          fontWeight: isCurrent ? '700' : '400',
                        }
                      ]}>
                        {eta}
                      </Text>
                    )}
                    {isPassed && (
                      <View style={styles.passedContainer}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14} color={Colors.checkboxBorder}
                        />
                        <Text style={styles.passedText}>Passed</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[
                    styles.sequenceText,
                    { color: isPassed ? Colors.checkboxBorder : Colors.textTertiary }
                  ]}>
                    Stop {stop.sequence || index + 1}
                    {isCurrent ? ' · Bus is here' : ''}
                  </Text>
                </View>
              </View>
            )
          })}

          {stops.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons
                name="map-outline" size={40} color={Colors.border}
              />
              <Text style={styles.emptyTitle}>No stops found</Text>
              <Text style={styles.emptyDesc}>
                Route data not available yet
              </Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline"
                size={18} color={Colors.red} />
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
    backgroundColor: Colors.yellowBar
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  routeText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.black55,
    letterSpacing: 0.3,
  },
  headerText: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 26,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  activityBadge: {
    backgroundColor: Colors.black10,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
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
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  stopRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
  },
  timelineDot: {
    zIndex: 1,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 48,
    marginTop: 4,
  },
  stopInfoRight: {
    flex: 1,
    paddingLeft: 14,
    paddingBottom: 28,
  },
  stopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stopNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stopNameText: {
    fontSize: 15,
    flex: 1,
  },
  yourStopBadge: {
    backgroundColor: Colors.amberBg,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.amberBorder,
  },
  yourStopText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: Colors.amberDark,
  },
  etaText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
    marginLeft: 8,
  },
  passedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passedText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.chevron,
  },
  sequenceText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: Colors.chevron,
    marginTop: 12,
  },
  emptyDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.checkboxBorder,
    marginTop: 4,
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
