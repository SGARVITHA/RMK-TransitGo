import { Ionicons } from '@expo/vector-icons'
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Dimensions,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
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

export default function AdminAuthScreen() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMMono_400Regular,
  })

  // Sign In state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!email || !password)
        throw new Error('Please fill in all fields.')

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
      if (signInError) throw signInError

      // Verify this user is actually an admin
      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
      if (profileError) throw profileError

      if (profile.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error(
          'Access denied. This account does not have admin privileges.'
        )
      }

      router.replace('/(admin)/')
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.yellowBar, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.textPrimary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TOP BAR */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#111111" />
              <Text style={styles.roleText}>Administrator</Text>
            </View>
          </View>

          {/* HEADER TEXT */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerSubtitle}>
              Restricted access,
            </Text>
            <Text style={styles.headerTitle}>
              Admin Sign In
            </Text>
          </View>

          {/* WHITE CARD */}
          <View style={styles.cardLayout}>
            <View>
              {/* EMAIL */}
              <Text style={styles.inputLabel}>ADMIN EMAIL</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#AAAAAA" style={styles.leftIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="admin@rmkcet.ac.in"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* PASSWORD */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>PASSWORD</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={Colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>

              {/* REMEMBER ME ROW */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberButton}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxActive
                  ]}>
                    {rememberMe && <Ionicons name="checkmark" size={12} color={Colors.textPrimary} />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text style={styles.forgotPassword}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* ERROR MESSAGE */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.red} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* SIGN IN BUTTON */}
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.8}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In to Admin Portal</Text>
                )}
              </TouchableOpacity>

              {/* IT DEPARTMENT NOTE */}
              <View style={{
                backgroundColor: '#FFFBEB',
                borderRadius: 14,
                padding: 16,
                marginTop: 20,
                borderWidth: 1,
                borderColor: '#FDE68A',
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <Ionicons name="information-circle-outline"
                  size={18} color="#D97706" style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: 'DMSans_600SemiBold',
                    fontSize: 13,
                    color: '#92400E',
                    marginBottom: 4,
                  }}>
                    Admin Access Only
                  </Text>
                  <Text style={{
                    fontFamily: 'DMSans_400Regular',
                    fontSize: 12,
                    color: '#B45309',
                    lineHeight: 18,
                  }}>
                    Admin accounts are provisioned exclusively by the
                    RMK College IT Department. Contact your system
                    administrator to request access.
                  </Text>
                </View>
              </View>

              {/* BOTTOM OF CARD */}
              <View style={{
                marginTop: 32,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6
              }}>
                <Ionicons name="lock-closed" size={12} color="#CCCCCC" />
                <Text style={{
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 11,
                  color: '#CCCCCC'
                }}>
                  Secure admin portal · RMK-TransitGo
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.yellowBar,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.darkYellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  headerContainer: {
    paddingHorizontal: 24,
    marginTop: 24,
    marginBottom: 32,
  },
  headerSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: 'rgba(0,0,0,0.6)',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 30,
    color: Colors.textPrimary,
    lineHeight: 36,
  },
  cardLayout: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    minHeight: height * 0.65,
    flex: 1,
  },
  inputLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    color: Colors.textSecond,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  leftIcon: {
    marginRight: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  rememberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.checkboxBorder,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: Colors.yellowBar,
    backgroundColor: Colors.yellowBar,
  },
  rememberText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textSecond,
  },
  forgotPassword: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 13,
    color: Colors.yellowBar,
  },
  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.red,
    flex: 1,
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#111111',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.surface,
  },
}) as any
