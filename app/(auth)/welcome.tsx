import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useRef } from 'react'
import {
  SafeAreaView, ScrollView, View, Text,
  TouchableOpacity, StyleSheet, Dimensions,
  StatusBar, ActivityIndicator, Animated
} from 'react-native'
import { router } from 'expo-router'
import {
  useFonts,
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
  DMSans_800ExtraBold,
} from '@expo-google-fonts/dm-sans'
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono'

import { Colors } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

export default function WelcomeScreen() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMMono_400Regular,
  })

  // CHANGE 5 — SCALE UP FROM CENTER ANIMATION ON LOAD
  const scaleAnim = useRef(new Animated.Value(0.92)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  // CHANGE 6 — STAGGERED CARD ANIMATION
  const card1Anim = useRef(new Animated.Value(0)).current
  const card2Anim = useRef(new Animated.Value(0)).current
  const card3Anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.stagger(80, [
        Animated.timing(card1Anim, {
          toValue: 1, duration: 300, useNativeDriver: true
        }),
        Animated.timing(card2Anim, {
          toValue: 1, duration: 300, useNativeDriver: true
        }),
        Animated.timing(card3Anim, {
          toValue: 1, duration: 300, useNativeDriver: true
        }),
      ]).start()
    })
  }, [])

  if (!fontsLoaded) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg} />

      {/* CHANGE 1 — FULL WIDTH YELLOW TOP BAR */}
      <View style={styles.yellowTopBar} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
          flex: 1,
        }}>
          <View style={styles.container}>

            {/* SECTION 2 — HERO */}
            <View style={styles.heroSection}>

              {/* CHANGE 3 — Replace logo box with plain text header */}
              <Text style={{
                fontFamily: 'DMSans_700Bold',
                fontSize: 32,
                color: '#000000ff',
                letterSpacing: 0.2,
                marginBottom: 4,
                marginTop: 30,
                paddingHorizontal: 24,
                textAlign: 'center',
              }}>
                RMK ENGINEERING COLLEGE
              </Text>

              <Text style={styles.campusTransportLabel}>CAMPUS TRANSPORT</Text>

              {/* CHANGE 5 — HERO TEXT SMALLER */}
              <Text style={styles.mainHeading}>Your campus, on the move.</Text>

            </View>

            {/* SECTION 3 — DIVIDER LINE */}
            <View style={styles.divider} />

            {/* SECTION 4 — ROLE SELECTION */}
            <View style={styles.roleSelection}>
              <View style={styles.labelRow}>
                <Text style={styles.leftLabel}>CONTINUE AS</Text>
                <Text style={styles.rightLabel}>Select your role</Text>
              </View>

              <Animated.View style={{ opacity: card1Anim, transform: [{ translateY: card1Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity
                  style={styles.cardContainer}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(auth)/student-auth')}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name="school-outline" size={20} color="#111111" />
                  </View>
                  <View style={styles.cardTextContainer}>
                    <Text style={styles.roleName}>Student</Text>
                    <Text style={styles.roleDesc}>Track your bus in real-time and signal your driver</Text>
                  </View>
                  <View style={styles.chevronBox}>
                    <Ionicons name="chevron-forward" size={16} color="#AAAAAA" />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ opacity: card2Anim, transform: [{ translateY: card2Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity
                  style={styles.cardContainer}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(auth)/driver-auth')}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name="bus-outline" size={20} color="#111111" />
                  </View>
                  <View style={styles.cardTextContainer}>
                    <Text style={styles.roleName}>Driver</Text>
                    <Text style={styles.roleDesc}>Manage your trips and respond to student alerts</Text>
                  </View>
                  <View style={styles.chevronBox}>
                    <Ionicons name="chevron-forward" size={16} color="#AAAAAA" />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ opacity: card3Anim, transform: [{ translateY: card3Anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                <TouchableOpacity
                  style={styles.cardContainer}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(auth)/admin-auth')}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#111111" />
                  </View>
                  <View style={styles.cardTextContainer}>
                    <Text style={styles.roleName}>Administrator</Text>
                    <Text style={styles.roleDesc}>Oversee fleet, routes, stops and trip history</Text>
                  </View>
                  <View style={styles.chevronBox}>
                    <Ionicons name="chevron-forward" size={16} color="#AAAAAA" />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>



            {/* SECTION 6 — FOOTER */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>RMK Engineering College</Text>
            </View>

          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  yellowTopBar: {
    width: '100%',
    backgroundColor: Colors.yellowBar,
    paddingTop: 0,
    height: 6,
  },
  scrollView: {
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  heroSection: {
    marginTop: 16,
  },
  logoContainer: {
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 8,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  logoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.yellowBar, // #F5C518
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: '#111111',
    letterSpacing: 0.3,
  },
  logoSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#888888',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  campusTransportLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    color: '#AAAAAA',
    letterSpacing: 3,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  mainHeading: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 24,
    color: '#111111ff',
    lineHeight: 38,
    marginTop: 30,
    letterSpacing: -0.5,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border, // #EEEEEE for light mode
    marginBottom: 32,
  },
  roleSelection: {
    // container for roles
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leftLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    color: Colors.darkDim, // #555555
    letterSpacing: 2,
  },
  rightLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.darkDim, // #555555
  },
  cardContainer: {
    backgroundColor: Colors.surface, // #FFFFFF
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder, // #F0F0F0
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.yellowBar, // #F5C518
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTextContainer: {
    flex: 1,
  },
  roleName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#111111',
    marginBottom: 2,
  },
  roleDesc: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#888888',
    lineHeight: 16,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    marginTop: 32,
    backgroundColor: Colors.darkCard, // Keeps the dark appearance contrasting light elements!
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    paddingVertical: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 20,
    color: Colors.surface, // #FFFFFF
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: '#666666',
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.darkBorder,
  },
  footer: {
    marginTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
})
