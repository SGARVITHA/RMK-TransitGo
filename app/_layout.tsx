import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Slot, router } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/(auth)/welcome')
        setChecking(false)
        return
      }
      supabase.from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.role === 'student') router.replace('/(student)/')
          else if (profile?.role === 'driver') router.replace('/(driver)/')
          else if (profile?.role === 'admin') router.replace('/(admin)/')
          else router.replace('/(auth)/welcome')
          setChecking(false)
        })
    })
  }, [])

  if (checking) return (
    <View style={{
      flex: 1, backgroundColor: '#FAFAF8',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <ActivityIndicator size="large" color="#F5C518" />
    </View>
  )

  return <Slot />
}
