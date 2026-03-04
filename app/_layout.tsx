import React, { useEffect, useState } from 'react'
import { Stack, SplashScreen, useRouter } from 'expo-router'
import { View, ActivityIndicator, Platform } from 'react-native'
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import {
  DMMono_400Regular,
  DMMono_500Medium,
  DMMono_700Bold,
} from '@expo-google-fonts/dm-mono'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/theme'

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync()
}

export default function RootLayout() {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
    DMMono_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded && Platform.OS !== 'web') {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded])

  useEffect(() => {
    let didFinish = false

    const fallbackTimer = setTimeout(() => {
      if (didFinish) return
      router.replace('/(auth)/welcome')
      setIsReady(true)
    }, 1500)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/(auth)/welcome')
      } else {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.role === 'student') router.replace('/(student)/')
            else if (profile?.role === 'driver') router.replace('/(driver)/')
            else if (profile?.role === 'admin') router.replace('/(admin)/')
            else router.replace('/(auth)/welcome')
          })
      }
      didFinish = true
      clearTimeout(fallbackTimer)
      setIsReady(true)
    })

    return () => {
      didFinish = true
      clearTimeout(fallbackTimer)
    }
  }, [])

  if (!isReady) {
    return (
      <View style={{flex:1, backgroundColor:'#FAFAF8', alignItems:'center', justifyContent:'center'}}>
        <ActivityIndicator size="large" color="#F5C518" />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  )
}

