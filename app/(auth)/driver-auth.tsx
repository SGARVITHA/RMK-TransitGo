import { Ionicons } from '@expo/vector-icons'
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Dimensions,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, Modal
} from 'react-native'
import { router } from 'expo-router'
import { useState, useRef, useEffect } from 'react'
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

const getPasswordStrength = (pass: string) => {
  if (pass.length === 0) return 0
  if (pass.length < 6) return 1
  if (pass.length < 10 || !/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) return 2
  return 3
}

const strengthLabel = ['', 'Weak', 'Medium', 'Strong']
const strengthColor = ['', Colors.red, Colors.amber, Colors.green]
const strengthWidth = ['0%', '33%', '66%', '100%']

export default function DriverAuthScreen() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSans_800ExtraBold,
    DMMono_400Regular,
  })

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  // Sign In state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sign Up state
  const [name, setName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [empId, setEmpId] = useState('')
  const [busNumber, setBusNumber] = useState('')
  const [numberPlate, setNumberPlate] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)

  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const [passwordStrength, setPasswordStrength] = useState(0)

  useEffect(() => {
    setPasswordStrength(getPasswordStrength(signupPassword))
  }, [signupPassword])

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!email || !password)
        throw new Error('Please fill in all fields.')
      if (password.length < 6)
        throw new Error('Password must be at least 6 characters.')

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) throw signInError
      router.replace('/(driver)/')
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setLoading(true)
    setSignupError(null)
    try {
      if (!name || !empId || !signupEmail || !busNumber ||
        !numberPlate || !signupPassword || !confirmPassword)
        throw new Error('Please fill in all fields.')

      if (!busNumber.startsWith('Bus '))
        throw new Error('Bus Number must start with "Bus " e.g. Bus 5')

      if (signupPassword.length < 6)
        throw new Error('Password must be at least 6 characters.')

      if (signupPassword !== confirmPassword)
        throw new Error('Passwords do not match.')

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
      })
      if (signUpError) throw signUpError
      if (!data.user) throw new Error('Sign up failed.')

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: name,
          role: 'driver'
        })
      if (profileError) throw profileError

      const { error: driverError } = await supabase
        .from('drivers')
        .insert({
          id: data.user.id,
          employee_id: empId,
          bus_number: busNumber,
          number_plate: numberPlate,
          email: signupEmail.trim().toLowerCase(),
        })
      if (driverError) throw driverError

      await supabase.auth.signInWithPassword({
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
      })

      setShowSuccessModal(true)
    } catch (err: any) {
      setSignupError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
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
              <Ionicons name="bus-outline" size={13} color={Colors.textPrimary} />
              <Text style={styles.roleText}>Driver</Text>
            </View>
          </View>

          {/* HEADER TEXT */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerSubtitle}>
              {mode === 'signin' ? 'Welcome back,' : 'Join as a driver,'}
            </Text>
            <Text style={styles.headerTitle}>
              {mode === 'signin' ? 'Driver Sign In' : 'Create your account'}
            </Text>
          </View>

          {/* WHITE CARD */}
          <View style={styles.cardLayout}>
            {mode === 'signin' ? (
              // SIGN IN FORM
              <View>
                {/* EMAIL */}
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="your@rmkcet.ac.in"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
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
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                {/* SWITCH TO SIGN UP */}
                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Don't have an account?</Text>
                  <TouchableOpacity onPress={() => setMode('signup')}>
                    <Text style={styles.switchAction}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // SIGN UP FORM
              <View>
                {/* PERSONAL INFO CARD */}
                <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>
                <View style={styles.sectionCard}>
                  {/* FULL NAME */}
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.leftIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Rajan Kumar"
                      placeholderTextColor={Colors.textTertiary}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  {/* EMPLOYEE ID */}
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>EMPLOYEE ID</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="card-outline" size={18} color={Colors.textTertiary} style={styles.leftIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. EMP-0042"
                      placeholderTextColor={Colors.textTertiary}
                      value={empId}
                      onChangeText={setEmpId}
                    />
                  </View>
                  <Text style={styles.inputHint}>Format: EMP- followed by number</Text>

                  {/* COLLEGE EMAIL */}
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>COLLEGE EMAIL</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.leftIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="driver@rmkcet.ac.in"
                      placeholderTextColor={Colors.textTertiary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={signupEmail}
                      onChangeText={setSignupEmail}
                    />
                  </View>
                </View>

                {/* BUS INFORMATION CARD */}
                <Text style={styles.sectionLabel}>BUS INFORMATION</Text>
                <View style={styles.sectionCard}>
                  {/* BUS NUMBER */}
                  <Text style={styles.inputLabel}>BUS NUMBER</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="bus-outline" size={18} color={Colors.textTertiary} style={styles.leftIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Bus 5"
                      placeholderTextColor={Colors.textTertiary}
                      value={busNumber}
                      onChangeText={setBusNumber}
                    />
                  </View>
                  <Text style={styles.inputHint}>Format: "Bus" followed by number e.g. Bus 5</Text>

                  {/* NUMBER PLATE */}
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>NUMBER PLATE</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="car-outline" size={18} color={Colors.textTertiary} style={styles.leftIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. TN09 AB 1234"
                      placeholderTextColor={Colors.textTertiary}
                      autoCapitalize="characters"
                      value={numberPlate}
                      onChangeText={setNumberPlate}
                    />
                  </View>
                  <Text style={styles.inputHint}>Vehicle registration number</Text>
                </View>

                {/* SECURITY CARD */}
                <Text style={styles.sectionLabel}>SECURITY</Text>
                <View style={styles.sectionCard}>
                  {/* PASSWORD */}
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textTertiary}
                      secureTextEntry={!showSignupPassword}
                      value={signupPassword}
                      onChangeText={setSignupPassword}
                    />
                    <TouchableOpacity onPress={() => setShowSignupPassword(!showSignupPassword)}>
                      <Ionicons
                        name={showSignupPassword ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={Colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Password Strength Indicator */}
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthTrack}>
                      <View style={[
                        styles.strengthFill,
                        {
                          width: strengthWidth[passwordStrength] as any,
                          backgroundColor: strengthColor[passwordStrength]
                        }
                      ]} />
                    </View>
                    {signupPassword.length > 0 && (
                      <Text style={[styles.strengthLabel, { color: strengthColor[passwordStrength] }]}>
                        {strengthLabel[passwordStrength]}
                      </Text>
                    )}
                  </View>

                  {/* CONFIRM PASSWORD */}
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>CONFIRM PASSWORD</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textTertiary}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Ionicons
                        name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={Colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword !== signupPassword && confirmPassword.length > 0 && (
                    <Text style={styles.mismatchText}>Passwords do not match</Text>
                  )}
                </View>

                {/* ERROR MESSAGE */}
                {signupError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={16} color={Colors.red} />
                    <Text style={styles.errorText}>{signupError}</Text>
                  </View>
                )}

                {/* SIGN UP BUTTON */}
                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 8 }]}
                  activeOpacity={0.8}
                  onPress={handleSignUp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.surface} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                {/* SWITCH TO SIGN IN */}
                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Already registered?</Text>
                  <TouchableOpacity onPress={() => setMode('signin')}>
                    <Text style={styles.switchAction}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* SUCCESS MODAL */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconBox}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.green} />
            </View>
            <Text style={styles.successTitle}>Ready to drive!</Text>
            <Text style={styles.successMessage}>
              Account created successfully.{'\n'}Welcome to RMK-TransitGo Driver Portal.
            </Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowSuccessModal(false)
                router.replace('/(driver)/')
              }}
            >
              <Text style={styles.successButtonText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.yellowBar,
    alignItems: 'center',
    justifyContent: 'center'
  },
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
    backgroundColor: Colors.textPrimary,
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
  switchRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  switchText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: Colors.textSecond,
  },
  switchAction: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    color: Colors.yellowBar,
  },
  sectionLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    color: Colors.textSecond,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inputHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 6,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 11,
    marginTop: 4,
  },
  mismatchText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: Colors.red,
    marginTop: 4,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  successIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontFamily: 'DMSans_800ExtraBold',
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: Colors.textSecond,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  successButton: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: Colors.surface,
  },
}) as any
