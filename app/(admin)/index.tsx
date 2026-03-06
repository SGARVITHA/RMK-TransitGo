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
import { useRouter } from 'expo-router'
import { Colors } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { Bus, Route } from '../../lib/types'

interface BusWithRoute extends Bus {
  routes?: Route | null
}

export default function AdminFleetScreen() {
  const router = useRouter()
  const [buses, setBuses] = useState<BusWithRoute[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [busNumber, setBusNumber] = useState('')
  const [numberPlate, setNumberPlate] = useState('')
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [routePickerVisible, setRoutePickerVisible] = useState(false)

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
      setRoutes(routesData ?? [])

      const { data: busesData, error: busesError } = await supabase
        .from('buses')
        .select('*, routes(*)')
        .order('bus_number', { ascending: true })
      if (busesError) {
        throw busesError
      }
      setBuses((busesData as BusWithRoute[]) ?? [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to load fleet. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resetForm = () => {
    setBusNumber('')
    setNumberPlate('')
    setSelectedRouteId(null)
  }

  const handleSaveBus = async () => {
    if (!busNumber || !numberPlate || !selectedRouteId) {
      return
    }
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('buses').insert({
        bus_number: busNumber.trim(),
        number_plate: numberPlate.trim(),
        route_id: selectedRouteId,
        status: 'idle',
      })
      if (insertError) {
        throw insertError
      }
      setModalVisible(false)
      resetForm()
      await load()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to add bus. Please try again.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBus = async (busId: string) => {
    try {
      await supabase
        .from('buses')
        .delete()
        .eq('id', busId)
      await load()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to delete bus. Please try again.'
      setError(message)
    }
  }

  const renderStatusBadge = (status: Bus['status']) => {
    const isOnTrip = status === 'on_trip'
    return (
      <View
        style={[
          styles.statusBadge,
          isOnTrip ? styles.statusOnTrip : styles.statusIdle,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isOnTrip ? styles.statusTextOnTrip : styles.statusTextIdle,
          ]}
        >
          {isOnTrip ? 'ON TRIP' : 'IDLE'}
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
      <FlatList
        data={buses}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.busCard}>
            <View style={styles.busRowTop}>
              <View>
                <Text style={styles.busNumber}>{item.bus_number}</Text>
                <Text style={styles.numberPlate}>{item.number_plate}</Text>
              </View>
              {renderStatusBadge(item.status)}
            </View>
            <View style={styles.busRowBottom}>
              <Text style={styles.routeName}>
                {item.routes?.name ? item.routes.name : 'Unassigned route'}
              </Text>
              <TouchableOpacity
                onPress={() => void handleDeleteBus(item.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚌</Text>
            <Text style={styles.emptyText}>No buses added yet.</Text>
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
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            await supabase.auth.signOut()
            router.replace('/(auth)/welcome')
          }}
          activeOpacity={0.9}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.modalTitle}>Add Bus</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bus Number</Text>
              <TextInput
                value={busNumber}
                onChangeText={setBusNumber}
                style={styles.input}
                placeholderTextColor={Colors.textSecond}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number Plate</Text>
              <TextInput
                value={numberPlate}
                onChangeText={setNumberPlate}
                style={styles.input}
                placeholderTextColor={Colors.textSecond}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Assign Route</Text>
              <TouchableOpacity
                style={styles.routeSelector}
                onPress={() => setRoutePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.routeSelectorText}>
                  {routes.find(r => r.id === selectedRouteId)?.name ?? 'Select route'}
                </Text>
              </TouchableOpacity>
            </View>

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
                  (!busNumber || !numberPlate || !selectedRouteId || saving) &&
                  styles.modalSaveButtonDisabled,
                ]}
                disabled={!busNumber || !numberPlate || !selectedRouteId || saving}
                onPress={() => void handleSaveBus()}
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

      <Modal
        visible={routePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoutePickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setRoutePickerVisible(false)}
        >
          <View style={styles.routePickerContent}>
            <Text style={styles.modalTitle}>Select Route</Text>
            <FlatList
              data={routes}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.routeOption}
                  onPress={() => {
                    setSelectedRouteId(item.id)
                    setRoutePickerVisible(false)
                  }}
                >
                  <Text style={styles.routeOptionText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No routes created yet.</Text>
              }
            />
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
  busCard: {
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
  busRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  busRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  busNumber: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontFamily: 'DMMono_700Bold',
  },
  numberPlate: {
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMMono_400Regular',
    marginTop: 2,
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
  deleteText: {
    fontSize: 13,
    color: Colors.red,
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
    marginBottom: 14,
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
  routeSelector: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  routeSelectorText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
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
  routePickerContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    marginTop: 'auto',
  },
  routeOption: {
    paddingVertical: 10,
  },
  routeOptionText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  signOutButton: {
    marginTop: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.red,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  signOutText: {
    fontSize: 15,
    color: Colors.red,
    fontFamily: 'DMSans_700Bold',
  },
})

