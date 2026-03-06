import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native'
import { Colors } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { Driver, Stop, Trip, Route as RouteType } from '../../lib/types'

interface Row {
  stop: Stop
  eta: string
}

export default function DriverRouteScreen() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [route, setRoute] = useState<RouteType | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
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

        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', user.id)
          .single<Driver>()
        if (driverError) {
          throw driverError
        }
        setDriver(driverData)

        const { data: tripData } = await supabase
          .from('trips')
          .select('*')
          .eq('bus_number', driverData.bus_number)
          .eq('status', 'active')
          .maybeSingle<Trip>()
        if (!tripData) {
          setTrip(null)
          setRows([])
          return
        }
        setTrip(tripData)

        if (tripData.route_id) {
          const { data: routeData } = await supabase
            .from('routes')
            .select('*')
            .eq('id', tripData.route_id)
            .single<RouteType>()
          setRoute(routeData)

          const { data: stopsData } = await supabase
            .from('stops')
            .select('*')
            .eq('route_id', tripData.route_id)
            .order('sequence', { ascending: true })
            .returns<Stop[]>()

          if (stopsData) {
            const staticRows = stopsData.map((stop, index) => ({
              stop,
              eta: `${8 + index}:30 am`,
            }))
            setRows(staticRows)
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load route. Please try again.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

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

  if (!trip || !route || !driver) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No active trip right now.</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{route.name}</Text>
        <Text style={styles.headerSubtitle}>Bus {driver.bus_number}</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={item => item.stop.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const isCurrent = index === 0
          return (
            <View
              style={[
                styles.row,
                isCurrent && styles.rowCurrent,
              ]}
            >
              <View
                style={[
                  styles.sequenceBadge,
                  isCurrent && styles.sequenceBadgeCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.sequenceText,
                    isCurrent && styles.sequenceTextCurrent,
                  ]}
                >
                  {item.stop.sequence}
                </Text>
              </View>
              <View style={styles.rowCenter}>
                <Text style={styles.stopName}>{item.stop.name}</Text>
                <Text style={styles.stopEta}>{item.eta}</Text>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
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
  emptyText: {
    fontSize: 14,
    color: Colors.textSecond,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowCurrent: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  sequenceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  sequenceBadgeCurrent: {
    backgroundColor: Colors.primary,
  },
  sequenceText: {
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMMono_500Medium',
  },
  sequenceTextCurrent: {
    color: Colors.dark,
  },
  rowCenter: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  stopEta: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
  },
})

