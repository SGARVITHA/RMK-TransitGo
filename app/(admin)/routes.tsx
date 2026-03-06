import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from 'react-native'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react-native'
import { Colors } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { Bus, Route, Stop } from '../../lib/types'

interface RouteWithMeta extends Route {
  buses?: Bus[]
  stops?: Stop[]
}

export default function AdminRoutesScreen() {
  const [routes, setRoutes] = useState<RouteWithMeta[]>([])
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [routeName, setRouteName] = useState('')
  const [stopsDraft, setStopsDraft] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: routesData, error: routesError } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: true })
        .returns<Route[]>()
      if (routesError) {
        throw routesError
      }

      const routeIds = (routesData ?? []).map(r => r.id)

      const { data: stopsData } = await supabase
        .from('stops')
        .select('*')
        .in('route_id', routeIds.length > 0 ? routeIds : ['00000000-0000-0000-0000-000000000000'])
        .order('sequence', { ascending: true })
        .returns<Stop[]>()

      const { data: busesData } = await supabase
        .from('buses')
        .select('*')
        .in('route_id', routeIds.length > 0 ? routeIds : ['00000000-0000-0000-0000-000000000000'])
        .returns<Bus[]>()

      const routesWithMeta: RouteWithMeta[] = (routesData ?? []).map(route => ({
        ...route,
        stops: (stopsData ?? []).filter(s => s.route_id === route.id),
        buses: (busesData ?? []).filter(b => b.route_id === route.id),
      }))

      setRoutes(routesWithMeta)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load routes. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setRouteName('')
    setStopsDraft([''])
  }

  const handleAddStopRow = () => {
    setStopsDraft(prev => [...prev, ''])
  }

  const handleRemoveStopRow = (index: number) => {
    setStopsDraft(prev => prev.filter((_, i) => i !== index))
  }

  const handleChangeStop = (index: number, value: string) => {
    setStopsDraft(prev => prev.map((s, i) => (i === index ? value : s)))
  }

  const handleSaveRoute = async () => {
    const stopsClean = stopsDraft.map(s => s.trim()).filter(Boolean)
    if (!routeName.trim() || stopsClean.length === 0) {
      return
    }
    setSaving(true)
    try {
      const { data: routeData, error: routeError } = await supabase
        .from('routes')
        .insert({ name: routeName.trim() })
        .select()
        .single<Route>()
      if (routeError) {
        throw routeError
      }

      const stopsToInsert = stopsClean.map((name, index) => ({
        route_id: routeData.id,
        name,
        sequence: index + 1,
      }))

      const { error: stopsError } = await supabase.from('stops').insert(stopsToInsert)
      if (stopsError) {
        throw stopsError
      }

      setModalVisible(false)
      resetForm()
      await load()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to add route. Please try again.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await supabase
        .from('routes')
        .delete()
        .eq('id', routeId)
      if (expandedRouteId === routeId) {
        setExpandedRouteId(null)
      }
      await load()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to delete route. Please try again.'
      setError(message)
    }
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
      <FlatList
        data={routes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isExpanded = expandedRouteId === item.id
          const assignedBus = item.buses?.[0]
          return (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{item.name}</Text>
                  <Text style={styles.assignedBus}>
                    {assignedBus ? `Bus ${assignedBus.bus_number}` : 'No bus assigned'}
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  <View style={styles.stopBadge}>
                    <Text style={styles.stopBadgeText}>
                      {item.stops?.length ?? 0} stops
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedRouteId(prev => (prev === item.id ? null : item.id))
                    }
                    hitSlop={8}
                  >
                    {isExpanded ? (
                      <ChevronUp size={18} color={Colors.textSecond} />
                    ) : (
                      <ChevronDown size={18} color={Colors.textSecond} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void handleDeleteRoute(item.id)}
                    hitSlop={10}
                    style={styles.trashButton}
                  >
                    <Trash2 size={16} color={Colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
              {isExpanded && item.stops && (
                <View style={styles.stopsList}>
                  {item.stops.map(stop => (
                    <View key={stop.id} style={styles.stopRow}>
                      <View style={styles.sequenceBadge}>
                        <Text style={styles.sequenceText}>{stop.sequence}</Text>
                      </View>
                      <Text style={styles.stopName}>{stop.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyText}>No routes created yet.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false)
          resetForm()
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setModalVisible(false)
            resetForm()
          }}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Route</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Route name</Text>
              <TextInput
                value={routeName}
                onChangeText={setRouteName}
                style={styles.input}
                placeholderTextColor={Colors.textSecond}
              />
            </View>
            <Text style={styles.inputLabel}>Stops</Text>
            {stopsDraft.map((stop, index) => (
              <View key={index} style={styles.stopInputRow}>
                <TextInput
                  value={stop}
                  onChangeText={value => handleChangeStop(index, value)}
                  style={[styles.input, styles.stopInput]}
                  placeholder={`Stop ${index + 1}`}
                  placeholderTextColor={Colors.textSecond}
                />
                {stopsDraft.length > 1 && (
                  <TouchableOpacity
                    onPress={() => handleRemoveStopRow(index)}
                    style={styles.removeStopButton}
                  >
                    <Text style={styles.removeStopText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.addStopButton}
              onPress={handleAddStopRow}
            >
              <Text style={styles.addStopText}>+ Add stop</Text>
            </TouchableOpacity>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setModalVisible(false)
                  resetForm()
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (saving || !routeName.trim()) && styles.modalSaveButtonDisabled,
                ]}
                disabled={saving || !routeName.trim()}
                onPress={() => void handleSaveRoute()}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeName: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
  },
  assignedBus: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
  },
  stopBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    marginRight: 4,
  },
  stopBadgeText: {
    fontSize: 12,
    color: Colors.dark,
    fontFamily: 'DMSans_600SemiBold',
  },
  trashButton: {
    marginLeft: 4,
  },
  stopsList: {
    marginTop: 12,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sequenceBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  sequenceText: {
    fontSize: 12,
    color: Colors.textSecond,
    fontFamily: 'DMMono_500Medium',
  },
  stopName: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_500Medium',
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
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: Colors.dark,
    fontFamily: 'DMSans_700Bold',
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
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecond,
    marginBottom: 4,
    fontFamily: 'DMSans_400Regular',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  stopInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stopInput: {
    flex: 1,
  },
  removeStopButton: {
    marginLeft: 8,
  },
  removeStopText: {
    fontSize: 12,
    color: Colors.red,
    fontFamily: 'DMSans_500Medium',
  },
  addStopButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
  },
  addStopText: {
    fontSize: 13,
    color: Colors.dark,
    fontFamily: 'DMSans_600SemiBold',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  modalCancelText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: 14,
    color: Colors.surface,
    fontFamily: 'DMSans_700Bold',
  },
})

