import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Colors } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { Bus, Driver, Profile } from '../../lib/types'
import { useRouter } from 'expo-router'

interface DriverWithProfile extends Driver {}

export default function DriverProfileScreen() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [driver, setDriver] = useState<DriverWithProfile | null>(null)
  const [bus, setBus] = useState<Bus | null>(null)
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

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single<Profile>()
        setProfile(profileData)

        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('id', user.id)
          .single<Driver>()
        setDriver(driverData)

        const { data: busData } = await supabase
          .from('buses')
          .select('*')
          .eq('bus_number', driverData.bus_number)
          .maybeSingle<Bus>()
        if (busData) {
          setBus(busData)
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load profile. Please try again.'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/welcome')
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.dark} />
      </View>
    )
  }

  if (error || !profile || !driver) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Profile not found.'}</Text>
      </View>
    )
  }

  const initials = profile.full_name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.roleLabel}>Driver</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Employee ID</Text>
        <Text style={styles.cardValueMono}>{driver.employee_id}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Email</Text>
        <Text style={styles.cardValue}>{driver.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Bus Number</Text>
        <Text style={styles.cardValueMono}>{driver.bus_number}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Number Plate</Text>
        <Text style={styles.cardValueMono}>{driver.number_plate}</Text>
      </View>

      {bus && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Bus Status</Text>
          <Text style={styles.cardValue}>{bus.status === 'on_trip' ? 'On Trip' : 'Idle'}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.9}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 20,
    paddingTop: 40,
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    color: Colors.dark,
    fontFamily: 'DMSans_700Bold',
  },
  name: {
    fontSize: 20,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_700Bold',
  },
  roleLabel: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecond,
    fontFamily: 'DMSans_400Regular',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 12,
    color: Colors.textSecond,
    marginBottom: 4,
    fontFamily: 'DMSans_400Regular',
  },
  cardValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMSans_600SemiBold',
  },
  cardValueMono: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontFamily: 'DMMono_500Medium',
  },
  signOutButton: {
    marginTop: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.red,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 15,
    color: Colors.red,
    fontFamily: 'DMSans_600SemiBold',
  },
})

