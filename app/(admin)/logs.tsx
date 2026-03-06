import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native'
import { Colors } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { Profile, Route, Trip } from '../../lib/types'

interface TripWithMeta extends Trip {
  route?: Route | null
  driverProfile?: Profile | null
}

export default function AdminLogsScreen() {
  const [trips, setTrips] = useState<TripWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [detailTrip, setDetailTrip] = useState<TripWithMeta | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<Trip[]>()
      if (tripsError) {
        throw tripsError
      }

      const routeIds = Array.from(new Set((tripsData ?? []).map(t => t.route_id).filter(Boolean)))
      const driverIds = Array.from(
        new Set((tripsData ?? []).map(t => t.driver_id).filter(Boolean)),
      )

      const { data: routesData } = await supabase
        .from('routes')
        .select('*')
        .in('id', routeIds.length > 0 ? routeIds : ['00000000-0000-0000-0000-000000000000'])
        .returns<Route[]>()

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', driverIds.length > 0 ? driverIds : ['00000000-0000-0000-0000-000000000000'])
        .returns<Profile[]>()

      const tripsWithMeta: TripWithMeta[] = (tripsData ?? []).map(trip => ({
        ...trip,
        route: (routesData ?? []).find(r => r.id === trip.route_id) ?? null,
        driverProfile: (profilesData ?? []).find(p => p.id === trip.driver_id) ?? null,
      }))

      setTrips(tripsWithMeta)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load trip logs. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggleTodayFilter = () => {
    setSelectedDate(prev => (prev ? null : new Date()))
  }

  const filteredTrips = useMemo(() => {
    if (!selectedDate) {
      return trips
    }
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const date = selectedDate.getDate()
    return trips.filter(trip => {
      const dt = new Date(trip.created_at)
      return dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === date
    })
  }, [trips, selectedDate])

  const formatDateTimeRange = (trip: Trip) => {
    const start = new Date(trip.start_time)
    const end = trip.end_time ? new Date(trip.end_time) : null
    const datePart = start.toLocaleDateString()
    const startTime = start.toLocaleTimeString()
    const endTime = end ? end.toLocaleTimeString() : '—'
    return `${datePart} · ${startTime} → ${endTime}`
  }

  const formatDuration = (trip: Trip) => {
    if (!trip.end_time) {
      return 'In progress'
    }
    const start = new Date(trip.start_time).getTime()
    const end = new Date(trip.end_time).getTime()
    const diffMinutes = Math.max(0, Math.round((end - start) / 60000))
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    if (hours === 0) {
      return `${minutes} min`
    }
    return `${hours}h ${minutes}m`
  }

  const renderStatusBadge = (status: Trip['status']) => {
    const isCompleted = status === 'completed'
    return (
      <View
        style={[
          styles.statusBadge,
          isCompleted ? styles.badgeCompleted : styles.badgeActive,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isCompleted ? styles.statusTextCompleted : styles.statusTextActive,
          ]}
        >
          {isCompleted ? 'COMPLETED' : 'ACTIVE'}
        </Text>
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
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>Trip Logs</Text>
        <TouchableOpacity
          style={[
            styles.filterChip,
            selectedDate && styles.filterChipActive,
          ]}
          onPress={toggleTodayFilter}
        >
          <Text
            style={[
              styles.filterChipText,
              selectedDate && styles.filterChipTextActive,
            ]}
          >
            {selectedDate ? 'Today' : 'All days'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTrips}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.8}
            onPress={() => setDetailTrip(item)}
          >
            <Text style={styles.tripId}>{item.id}</Text>
            <View style={styles.rowMiddle}>
              <Text style={styles.rowTitle}>
                {item.route?.name ?? 'Route'} |{' '}
                {item.driverProfile?.full_name ?? 'Driver'}
              </Text>
              <Text style={styles.rowSubtitle}>{formatDateTimeRange(item)}</Text>
            </View>
            {renderStatusBadge(item.status)}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No logs to display.</Text>
          </View>
        }
      />

      <Modal
        visible={!!detailTrip}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailTrip(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDetailTrip(null)}
        >
          {detailTrip && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Trip Details</Text>
              <Text style={styles.modalLabel}>Trip ID</Text>
              <Text style={styles.modalMono}>{detailTrip.id}</Text>

              <Text style={styles.modalLabel}>Route</Text>
              <Text style={styles.modalValue}>
                {detailTrip.route?.name ?? 'Unknown Route'}
              </Text>

              <Text style={styles.modalLabel}>Driver</Text>
              <Text style={styles.modalValue}>
                {detailTrip.driverProfile?.full_name ?? 'Unknown Driver'}
              </Text>

              <Text style={styles.modalLabel}>Bus</Text>
              <Text style={styles.modalValue}>
                {detailTrip.bus_number} · {detailTrip.number_plate}
              </Text>

              <Text style={styles.modalLabel}>Time</Text>
              <Text style={styles.modalValue}>{formatDateTimeRange(detailTrip)}</Text>

              <Text style={styles.modalLabel}>Duration</Text>
              <Text style={styles.modalValue}>{formatDuration(detailTrip)}</Text>

              <View style={styles.modalStatusRow}>
                <Text style={styles.modalLabel}>Status</Text>
                {renderStatusBadge(detailTrip.status)}
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  filterLabel: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.dark,
    borderColor: Colors.dark,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMSans_500Medium',
  },
  filterChipTextActive: {
    color: Colors.surface,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  row: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tripId: {
    fontSize: 11,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
    flexShrink: 1,
    maxWidth: 110,
  },
  rowMiddle: {
    flex: 1,
    marginHorizontal: 10,
  },
  rowTitle: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeCompleted: {
    backgroundColor: Colors.green,
  },
  badgeActive: {
    backgroundColor: Colors.primary,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
  },
  statusTextCompleted: {
    color: '#022C22',
  },
  statusTextActive: {
    color: Colors.dark,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecond,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 12,
    color: Colors.textSecond,
    marginTop: 8,
    fontFamily: 'DMSans_400Regular',
  },
  modalValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  modalMono: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontFamily: 'DMMono_400Regular',
  },
  modalStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
})

