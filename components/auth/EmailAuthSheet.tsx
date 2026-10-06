import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/typography';
import { authService } from '../../services/authService';
import { User } from '../../types';

interface EmailAuthSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const EmailAuthSheet: React.FC<EmailAuthSheetProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const res = await authService.sendEmailOtp(email);
    setLoading(false);
    if (res.success) {
      setStep(2);
    } else {
      setErrorMsg(res.error || 'Failed to send OTP code');
    }
  };

  const handleVerifyCode = async () => {
    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMsg('Please enter a 6-digit OTP code');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const res = await authService.verifyEmailOtp(email, otp);
    setLoading(false);
    if (res.success) {
      onSuccess(res.user);
      onClose();
    } else {
      setErrorMsg(res.error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            {step === 1 ? 'Enter your email' : 'Check your inbox'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'We will send a 6-digit verification code to sign in.'
              : `We sent a code to ${email}`}
          </Text>

          {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          {step === 1 ? (
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrorMsg(null);
              }}
            />
          ) : (
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={(t) => {
                setOtp(t);
                setErrorMsg(null);
              }}
            />
          )}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={step === 1 ? handleSendCode : handleVerifyCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {step === 1 ? 'Send Code' : 'Verify & Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {step === 2 && (
            <TouchableOpacity style={styles.backLink} onPress={() => setStep(1)}>
              <Text style={styles.backLinkText}>Use a different email</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  closeIcon: {
    fontSize: 20,
    color: '#666',
  },
  title: {
    fontFamily: Fonts.Bricolage,
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  errorText: {
    color: Colors.PalFireRed,
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 20,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.PalFireRed,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  backLinkText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
